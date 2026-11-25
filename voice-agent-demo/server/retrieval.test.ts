import { describe, expect, it } from 'vitest'
import {
  InMemorySourceStore,
  ingestLeadershipSources,
} from './source-ingestion.js'
import {
  LexicalRetriever,
  type RetrievalRequest,
} from './retrieval.js'

describe('lexical knowledge retrieval', () => {
  it('returns the psychological-safety source for a known question', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)
    const retriever = new LexicalRetriever(store)

    const result = retriever.retrieve({
      question: 'How can I create psychological safety for my team?',
      limit: 3,
    })

    expect(result.results[0].sourceId).toBe('google-project-aristotle')
    expect(result.results[0].rank).toBe(1)
    expect(result.results[0].excerpt).toContain('Psychological safety')
  })

  it('returns constructive-feedback evidence for a paraphrased question', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)
    const retriever = new LexicalRetriever(store)

    const result = retriever.retrieve({
      question: 'What is a calm way to tell a colleague their work had an impact?',
      limit: 3,
    })

    expect(result.results[0].sourceId).toBe('atlassian-effective-feedback')
  })

  it('returns no sufficiently relevant evidence for an out-of-corpus question', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)

    const result = new LexicalRetriever(store).retrieve({
      question: 'How do I tune an automobile carburetor?',
      limit: 3,
    })

    expect(result.results).toHaveLength(0)
  })

  it('filters by source and applies the requested limit', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)

    const result = new LexicalRetriever(store).retrieve({
      question: 'team safety dependability leadership',
      sourceId: 'google-project-aristotle',
      limit: 1,
    } satisfies RetrievalRequest)

    expect(result.results).toHaveLength(1)
    expect(result.results[0].sourceId).toBe('google-project-aristotle')
  })

  it('rejects a limit outside the supported range', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)

    expect(() =>
      new LexicalRetriever(store).retrieve({
        question: 'feedback',
        limit: 0,
      }),
    ).toThrow('limit must be between 1 and 10')
  })

  it('retains conflicting sources in separate ranked results', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)

    const result = new LexicalRetriever(store).retrieve({
      question: 'team impact dependability feedback',
      limit: 3,
    })

    expect(result.results.length).toBeGreaterThanOrEqual(1)
  })

  it('handles a misspelled psychological-safety term where possible', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)

    const result = new LexicalRetriever(store).retrieve({
      question: 'psychological saftey team',
      limit: 3,
    })

    expect(result.results[0]?.sourceId).toBe('google-project-aristotle')
  })
})
