import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import {
  chunkSourceText,
  InMemorySourceStore,
  ingestLeadershipSources,
  PlainTextExtractor,
  purgeSource,
  validateSourcePolicy,
} from './source-ingestion.js'
import type { LearningSource } from './source-ingestion.js'
import { LexicalRetriever, type RetrievalResponse } from './retrieval.js'
import {
  createGroundedAnswerAdapter,
  GroundedAnswerProviderError,
} from './openai-answer.js'
import type { GroundedAnswerAdapter } from './grounded-answer.js'
import {
  LearningSessionStore,
  toSessionEvidence,
} from './learning-sessions.js'

export function buildApp(
  options: { answerAdapter?: GroundedAnswerAdapter } = {},
): FastifyInstance {
  const app = Fastify({
    logger: true,
  })
  const learningSources = new InMemorySourceStore()
  ingestLeadershipSources(learningSources)
  const retriever = new LexicalRetriever(learningSources)
  const answerAdapter = options.answerAdapter ?? createGroundedAnswerAdapter()
  const learningSessions = new LearningSessionStore()

  void app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  })

  app.get('/api/health', async () => ({
    status: 'ready',
    service: 'voice-agent-demo',
  }))

  app.get('/api/sources', async () => ({
    sources: learningSources.listSources().map((source) => ({
      ...source,
      chunks: learningSources.listChunks(source.id).length,
      excerpts: learningSources.listChunks(source.id).map((chunk) => chunk.text),
    })),
  }))

  app.post('/api/sessions', async (request, reply) => {
    try {
      const session = learningSessions.create()
      return reply.code(201).send({
        sessionId: session.id,
        createdAt: session.createdAt,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Learning session could not be created')
      return reply.code(503).send({
        error: 'Learning sessions are temporarily unavailable',
      })
    }
  })

  app.post('/api/sessions/:sessionId/reset', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const session = learningSessions.get(sessionId)
    if (!session) {
      return reply.code(404).send({ error: 'Learning session not found' })
    }
    learningSessions.reset(session)
    return reply.send({ sessionId, cleared: true })
  })

  app.post('/api/sessions/:sessionId/turns', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const session = learningSessions.get(sessionId)
    if (!session) {
      return reply.code(404).send({ error: 'Learning session not found' })
    }

    const body: unknown = request.body
    if (
      typeof body !== 'object' ||
      body === null ||
      !('question' in body) ||
      typeof body.question !== 'string'
    ) {
      return reply.code(400).send({ error: 'question must be a string' })
    }

    const question = body.question.trim()
    if (!question) {
      return reply.code(400).send({ error: 'question must not be empty' })
    }
    if (question.length > 1000) {
      return reply.code(400).send({
        error: 'question must be 1000 characters or fewer',
      })
    }

    const conversationContext = learningSessions.getContext(session)
    const retrievalQuestion = [
      ...conversationContext.map((turn) => turn.question),
      question,
    ].join(' ')

    let retrieval: RetrievalResponse
    try {
      retrieval = retriever.retrieve({
        question: retrievalQuestion,
        limit: 3,
      })
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Retrieval failed',
      })
    }

    try {
      const answer = await answerAdapter.answer({
        question,
        retrievalResults: retrieval.results,
        conversationContext,
      })
      const turnNumber = learningSessions.recordTurn(session, {
        question,
        answer: answer.speakableText,
        evidence: toSessionEvidence(retrieval.results),
      })

      return reply.send({
        question,
        retrieval,
        answer,
        session: { id: sessionId, turnNumber },
      })
    } catch (error) {
      if (error instanceof GroundedAnswerProviderError) {
        request.log.error({ statusCode: 502 }, 'Grounded answer provider failed')
        return reply.code(502).send({
          error: 'Answer generation is temporarily unavailable',
        })
      }
      request.log.error({ err: error }, 'Grounded answer generation failed')
      return reply.code(500).send({
        error: 'Answer generation failed',
      })
    }
  })

  app.post('/api/retrieve', async (request, reply) => {
    const body = request.body as
      | { question?: string; sourceId?: string; limit?: number }
      | undefined

    if (!body?.question || typeof body.question !== 'string') {
      return reply.code(400).send({
        error: 'question is required',
      })
    }

    try {
      return reply.send(retriever.retrieve({
        question: body.question,
        sourceId: body.sourceId,
        limit: body.limit,
      }))
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Retrieval failed',
      })
    }
  })

  app.post('/api/answer', async (request, reply) => {
    const body = request.body as
      | { question?: string; sourceId?: string; limit?: number }
      | undefined

    if (!body?.question || typeof body.question !== 'string') {
      return reply.code(400).send({
        error: 'question is required',
      })
    }

    let retrieval: RetrievalResponse
    try {
      retrieval = retriever.retrieve({
        question: body.question,
        sourceId: body.sourceId,
        limit: body.limit ?? 3,
      })
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Retrieval failed',
      })
    }

    try {
      const answer = await answerAdapter.answer({
        question: body.question,
        retrievalResults: retrieval.results,
      })

      return reply.send({
        question: retrieval.question,
        retrieval,
        answer,
      })
    } catch (error) {
      if (error instanceof GroundedAnswerProviderError) {
        request.log.error({ statusCode: 502 }, 'Grounded answer provider failed')
        return reply.code(502).send({
          error: 'Answer generation is temporarily unavailable',
        })
      }
      request.log.error({ err: error }, 'Grounded answer generation failed')
      return reply.code(500).send({
        error: 'Answer generation failed',
      })
    }
  })

  app.post('/api/sources', async (request, reply) => {
    const body = request.body as
      | (Partial<LearningSource> & { text?: string })
      | undefined

    if (
      !body ||
      !body.id ||
      !body.title ||
      !body.author ||
      !body.url ||
      !body.license ||
      !body.retrievedAt ||
      typeof body.text !== 'string'
    ) {
      return reply.code(400).send({
        error: 'id, title, author, url, license, retrievedAt, and text are required',
      })
    }

    if (!/^https:\/\//.test(body.url)) {
      return reply.code(400).send({
        error: 'Source URL must use HTTPS',
      })
    }

    if (!/^[a-z0-9-]+$/.test(body.id)) {
      return reply.code(400).send({
        error: 'Source ID must contain lowercase letters, digits, and hyphens only',
      })
    }

    try {
      validateSourcePolicy({
        url: body.url,
        license: body.license,
        text: body.text,
      })
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Source policy rejected input',
      })
    }

    const normalizedText = new PlainTextExtractor().extract(body.text)

    const source = {
      id: body.id,
      title: body.title,
      author: body.author,
      url: body.url,
      license: body.license,
      retrievedAt: body.retrievedAt,
      notes: body.notes ?? '',
    }
    learningSources.addSource(source, chunkSourceText(normalizedText, source.id))
    return reply.code(201).send({
      source,
      chunks: learningSources.listChunks(source.id).length,
    })
  })

  app.delete('/api/sources/:sourceId', async (request, reply) => {
    const { sourceId } = request.params as { sourceId: string }
    if (!learningSources.hasSource(sourceId)) {
      return reply.code(404).send({
        error: 'Source not found',
      })
    }
    const removed = purgeSource(learningSources, sourceId)
    if (removed === 0) {
      return reply.code(404).send({
        error: 'Source not found',
      })
    }
    return {
      sourceId,
      removedChunks: removed,
    }
  })

  return app
}
