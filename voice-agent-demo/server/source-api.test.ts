import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { GroundedAnswerProviderError } from './openai-answer.js'

describe('learning source API', () => {
  it('lists approved learning sources and their bounded excerpts', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/sources',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ sources: Array<{ title: string; chunks: number }> }>()
    expect(body.sources.length).toBeGreaterThanOrEqual(2)
    expect(body.sources[0].title).toContain('Google')
    expect(body.sources[0].chunks).toBeGreaterThan(0)

    await app.close()
  })

  it('adds and removes an approved custom source', async () => {
    const app = buildApp()

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: {
        id: 'clear-feedback-practice',
        title: 'Clear feedback practice',
        author: 'Local learning notes',
        url: 'https://example.com/leadership/clear-feedback',
        license: 'Owned demo content',
        retrievedAt: '2026-11-21',
        notes: 'Synthetic notes for a feedback practice exercise.',
        text: 'Describe the situation. Explain the impact. Ask for perspective.',
      },
    })

    expect(createResponse.statusCode).toBe(201)

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/sources/clear-feedback-practice',
    })
    expect(deleteResponse.statusCode).toBe(200)

    await app.close()
  })

  it('rejects prohibited source text and malformed requests', async () => {
    const app = buildApp()

    const prohibitedResponse = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: {
        id: 'private-source',
        title: 'Private source',
        author: 'Local',
        url: 'https://example.com/source',
        license: 'Owned',
        retrievedAt: '2026-11-21',
        text: 'EMPLOYER_CONFIDENTIAL details',
      },
    })
    expect(prohibitedResponse.statusCode).toBe(400)

    const missingSourceResponse = await app.inject({
      method: 'DELETE',
      url: '/api/sources/not-present',
    })
    expect(missingSourceResponse.statusCode).toBe(404)

    await app.close()
  })

  it('retrieves source evidence through the public API', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/retrieve',
      payload: {
        question: 'How does psychological safety help a team?',
        limit: 2,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{
      results: Array<{ sourceId: string; rank: number; excerpt: string }>
    }>()
    expect(body.results[0].sourceId).toBe('google-project-aristotle')
    expect(body.results[0].rank).toBe(1)
    expect(body.results[0].excerpt).toContain('Psychological safety')

    await app.close()
  })

  it('returns a grounded answer and citations through the public API', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/answer',
      payload: {
        question: 'How does psychological safety help a team?',
        limit: 3,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{
      answer: {
        speakableText: string
        sourceIds: string[]
        usedFallback: boolean
      }
    }>()
    expect(body.answer.speakableText).toContain('Psychological safety')
    expect(body.answer.sourceIds).toContain('google-project-aristotle')
    expect(body.answer.usedFallback).toBe(false)

    await app.close()
  })

  it('returns a safe gateway error when the configured answer provider fails', async () => {
    const app = buildApp({
      answerAdapter: {
        answer: async () => {
          throw new GroundedAnswerProviderError('Provider returned an internal error')
        },
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/answer',
      payload: {
        question: 'How does psychological safety help a team?',
      },
    })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({
      error: 'Answer generation is temporarily unavailable',
    })
    expect(response.body).not.toContain('internal error')

    await app.close()
  })
})
