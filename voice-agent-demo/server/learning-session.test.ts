import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { GroundedAnswerProviderError } from './openai-answer.js'
import type {
  GroundedAnswerAdapter,
  GroundedAnswerRequest,
  GroundedAnswerResult,
} from './grounded-answer.js'

function createRecordingAdapter() {
  const requests: GroundedAnswerRequest[] = []
  const adapter: GroundedAnswerAdapter = {
    async answer(request) {
      requests.push(request)
      return {
        speakableText: 'A grounded learning answer.',
        sourceIds: request.retrievalResults.map((item) => item.sourceId),
        citations: request.retrievalResults.map((item) => ({
          sourceId: item.sourceId,
          sourceTitle: item.sourceTitle,
          author: item.author,
          url: item.url,
          chunkId: item.chunkId,
          excerpt: item.excerpt,
        })),
        confidence: request.retrievalResults.length ? 'medium' : 'fallback',
        usedFallback: request.retrievalResults.length === 0,
      }
    },
  }
  return { adapter, requests }
}

async function createSession(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
  })
  expect(response.statusCode).toBe(201)
  return response.json<{ sessionId: string }>().sessionId
}

async function sendTurn(
  app: ReturnType<typeof buildApp>,
  sessionId: string,
  question: unknown,
) {
  return app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/turns`,
    payload: { question },
  })
}

describe('text learning sessions API', () => {
  it('creates an opaque session and returns the grounded answer contract for a turn', async () => {
    const { adapter } = createRecordingAdapter()
    const app = buildApp({ answerAdapter: adapter })
    const sessionId = await createSession(app)

    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i)
    const response = await sendTurn(
      app,
      sessionId,
      'How does psychological safety help a team?',
    )
    expect(response.statusCode).toBe(200)
    const body = response.json<{
      question: string
      answer: GroundedAnswerResult
      retrieval: { results: unknown[] }
      session: { id: string; turnNumber: number }
    }>()
    expect(body.question).toBe('How does psychological safety help a team?')
    expect(body.answer.speakableText).toBe('A grounded learning answer.')
    expect(body.answer.citations[0].sourceId).toBe('google-project-aristotle')
    expect(body.session).toEqual({ id: sessionId, turnNumber: 1 })

    await app.close()
  })

  it('uses only recent retrieved context for follow-up turns', async () => {
    const { adapter, requests } = createRecordingAdapter()
    const app = buildApp({ answerAdapter: adapter })
    const sessionId = await createSession(app)

    await sendTurn(app, sessionId, 'How does psychological safety help a team?')
    const response = await sendTurn(app, sessionId, 'Why is that important?')

    expect(response.statusCode).toBe(200)
    expect(requests[1].question).toBe('Why is that important?')
    expect(requests[1].conversationContext).toHaveLength(1)
    expect(requests[1].conversationContext?.[0].question).toBe(
      'How does psychological safety help a team?',
    )
    expect(requests[1].conversationContext?.[0].evidence[0].excerpt)
      .toContain('Psychological safety')
    expect(requests[1].retrievalResults[0].sourceId).toBe('google-project-aristotle')

    await app.close()
  })

  it('does not share context between sessions and reset clears prior context', async () => {
    const { adapter, requests } = createRecordingAdapter()
    const app = buildApp({ answerAdapter: adapter })
    const firstSessionId = await createSession(app)
    const secondSessionId = await createSession(app)

    await sendTurn(app, firstSessionId, 'How does psychological safety help a team?')
    await sendTurn(app, secondSessionId, 'What is constructive feedback?')
    expect(requests[1].conversationContext).toEqual([])

    const resetResponse = await app.inject({
      method: 'POST',
      url: `/api/sessions/${firstSessionId}/reset`,
    })
    expect(resetResponse.statusCode).toBe(200)
    expect(resetResponse.json()).toEqual({
      sessionId: firstSessionId,
      cleared: true,
    })

    await sendTurn(app, firstSessionId, 'Why is that important?')
    expect(requests[2].conversationContext).toEqual([])

    await app.close()
  })

  it('rejects empty, non-string, and overlong questions', async () => {
    const app = buildApp()
    const sessionId = await createSession(app)

    for (const question of ['', '   ', null, 'x'.repeat(1001)]) {
      const response = await sendTurn(app, sessionId, question)
      expect(response.statusCode).toBe(400)
    }

    await app.close()
  })

  it('rejects turns for unknown sessions', async () => {
    const app = buildApp()
    const missingResponse = await sendTurn(
      app,
      '00000000-0000-4000-8000-000000000000',
      'A question',
    )
    expect(missingResponse.statusCode).toBe(404)

    await app.close()
  })

  it('uses the standard fallback for questions without evidence', async () => {
    const app = buildApp()
    const sessionId = await createSession(app)

    const response = await sendTurn(app, sessionId, 'How do I tune a carburetor?')

    expect(response.statusCode).toBe(200)
    expect(response.json<{ answer: GroundedAnswerResult }>().answer).toMatchObject({
      speakableText:
        'I could not find enough evidence in the selected learning material.',
      sourceIds: [],
      usedFallback: true,
    })

    await app.close()
  })

  it('returns a safe provider error without storing a failed turn', async () => {
    let fail = true
    const requests: GroundedAnswerRequest[] = []
    const answerAdapter: GroundedAnswerAdapter = {
      async answer(request) {
        requests.push(request)
        if (fail) {
          throw new GroundedAnswerProviderError('provider detail must not leak')
        }
        return {
          speakableText: 'A grounded learning answer.',
          sourceIds: request.retrievalResults.map((item) => item.sourceId),
          citations: request.retrievalResults.map((item) => ({
            sourceId: item.sourceId,
            sourceTitle: item.sourceTitle,
            author: item.author,
            url: item.url,
            chunkId: item.chunkId,
            excerpt: item.excerpt,
          })),
          confidence: 'medium',
          usedFallback: false,
        }
      },
    }
    const app = buildApp({ answerAdapter })
    const sessionId = await createSession(app)

    const response = await sendTurn(
      app,
      sessionId,
      'How does psychological safety help a team?',
    )
    expect(response.statusCode).toBe(502)
    expect(response.body).not.toContain('provider detail')

    fail = false
    const retryResponse = await sendTurn(
      app,
      sessionId,
      'How does psychological safety help a team?',
    )
    expect(retryResponse.statusCode).toBe(200)
    expect(requests[1].conversationContext).toEqual([])

    await app.close()
  })
})
