import { describe, expect, it } from 'vitest'
import {
  OpenAICompatibleGroundedAnswerAdapter,
  type ChatCompletionResponse,
} from './openai-answer.js'
import type { RetrievalResult } from './retrieval.js'

const evidence: RetrievalResult = {
  rank: 1,
  chunkId: 'google-project-aristotle-chunk-1',
  sourceId: 'google-project-aristotle',
  sourceTitle: 'Google re:Work — The Five Keys to a Successful Team',
  author: 'Google re:Work',
  url: 'https://rework.withgoogle.com/intl/en/guides/understanding-team-effectiveness/',
  excerpt: 'Psychological safety helps team members speak up and share ideas.',
  score: 9,
  matchedTerms: ['psychological', 'safety'],
}
const unrelatedEvidence: RetrievalResult = {
  ...evidence,
  rank: 2,
  chunkId: 'atlassian-feedback-chunk-1',
  sourceId: 'atlassian-effective-feedback',
  sourceTitle: 'Atlassian Team Playbook',
  author: 'Atlassian',
  url: 'https://www.atlassian.com/team-playbook',
  excerpt: 'Feedback should be specific and describe the impact.',
}

function completion(content: string): ChatCompletionResponse {
  return {
    choices: [{ message: { content } }],
  }
}

describe('OpenAI-compatible grounded answer adapter', () => {
  it('sends only the question and retrieved evidence and validates citations', async () => {
    let capturedBody = ''
    let capturedAuthorization = ''
    const fetcher: typeof fetch = async (_input, init) => {
      capturedBody = String(init?.body)
      capturedAuthorization = new Headers(init?.headers).get('authorization') ?? ''
      return new Response(
        JSON.stringify(completion(JSON.stringify({
          answer: 'Psychological safety helps people speak up.',
          sourceIds: ['google-project-aristotle'],
        }))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const adapter = new OpenAICompatibleGroundedAnswerAdapter({
      apiKey: 'test-secret',
      model: 'test-model',
      baseUrl: 'https://llm.example/v1',
      fetcher,
    })
    const result = await adapter.answer({
      question: 'How do I help my team speak up?',
      retrievalResults: [evidence, unrelatedEvidence],
    })

    const sent = JSON.parse(capturedBody) as {
      messages: Array<{ role: string; content: string }>
    }
    expect(capturedAuthorization).toBe('Bearer test-secret')
    expect(sent.messages[0].role).toBe('system')
    expect(sent.messages[1].content).toContain('How do I help my team speak up?')
    expect(sent.messages[1].content).toContain(evidence.excerpt)
    expect(sent.messages[1].content).not.toContain(unrelatedEvidence.sourceId)
    expect(sent.messages[1].content).not.toContain('test-secret')
    expect(result.sourceIds).toEqual(['google-project-aristotle'])
    expect(result.citations[0].chunkId).toBe(evidence.chunkId)
  })

  it('rejects source IDs that were not present in retrieved evidence', async () => {
    const adapter = new OpenAICompatibleGroundedAnswerAdapter({
      apiKey: 'test-secret',
      model: 'test-model',
      baseUrl: 'https://llm.example/v1',
      fetcher: async () => new Response(
        JSON.stringify(completion(JSON.stringify({
          answer: 'Unsupported claim.',
          sourceIds: ['not-retrieved-source'],
        }))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    })

    await expect(adapter.answer({
      question: 'Question',
      retrievalResults: [evidence],
    })).rejects.toThrow('returned a citation outside retrieved evidence')
  })

  it('rejects a non-empty answer that has no citations', async () => {
    const adapter = new OpenAICompatibleGroundedAnswerAdapter({
      apiKey: 'test-secret',
      model: 'test-model',
      baseUrl: 'https://llm.example/v1',
      fetcher: async () => new Response(
        JSON.stringify(completion(JSON.stringify({
          answer: 'An unsupported answer.',
          sourceIds: [],
        }))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    })

    await expect(adapter.answer({
      question: 'Question',
      retrievalResults: [evidence],
    })).rejects.toThrow('must cite retrieved evidence')
  })

  it('returns the standard fallback without calling the model when evidence is empty', async () => {
    let called = false
    const adapter = new OpenAICompatibleGroundedAnswerAdapter({
      apiKey: 'test-secret',
      model: 'test-model',
      baseUrl: 'https://llm.example/v1',
      fetcher: async () => {
        called = true
        return new Response()
      },
    })

    const result = await adapter.answer({
      question: 'No evidence',
      retrievalResults: [],
    })

    expect(called).toBe(false)
    expect(result.usedFallback).toBe(true)
    expect(result.sourceIds).toEqual([])
  })
})
