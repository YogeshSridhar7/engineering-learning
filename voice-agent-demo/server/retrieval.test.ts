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
    const firstSource = {
      id: 'direct-feedback',
      title: 'Direct feedback guide',
      author: 'Source one',
      url: 'https://example.com/direct',
      license: 'Owned test content',
      retrievedAt: '2026-11-27',
      notes: '',
    }
    const secondSource = {
      ...firstSource,
      id: 'indirect-feedback',
      title: 'Indirect feedback guide',
      author: 'Source two',
      url: 'https://example.com/indirect',
    }
    store.addSource(firstSource, [{
      id: 'direct-chunk',
      sourceId: firstSource.id,
      position: 0,
      text: 'Feedback should be direct and immediate.',
    }])
    store.addSource(secondSource, [{
      id: 'indirect-chunk',
      sourceId: secondSource.id,
      position: 0,
      text: 'Feedback should be indirect and carefully delayed.',
    }])

    const result = new LexicalRetriever(store).retrieve({
      question: 'How should feedback be given?',
      limit: 2,
    })

    expect(result.results.map((item) => item.sourceId)).toEqual([
      'direct-feedback',
      'indirect-feedback',
    ])
    expect(result.results.map((item) => item.excerpt)).toEqual([
      'Feedback should be direct and immediate.',
      'Feedback should be indirect and carefully delayed.',
    ])
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
