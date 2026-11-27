import { describe, expect, it } from 'vitest'
import {
  InMemoryCosineVectorStore,
  OllamaEmbeddingProvider,
  OllamaEmbeddingProviderError,
  SemanticRetriever,
} from './semantic-retrieval.js'
import {
  InMemorySourceStore,
  type LearningSource,
} from './source-ingestion.js'
import type { EmbeddingProvider } from './semantic-retrieval.js'

const source: LearningSource = {
  id: 'team-safety',
  title: 'Team safety',
  author: 'Local notes',
  url: 'https://example.com/team-safety',
  license: 'Owned test content',
  retrievedAt: '2026-11-27',
  notes: '',
}

describe('semantic retrieval adapters', () => {
  it('calls Ollama embeddings endpoint with the configured model', async () => {
    let requestBody = ''
    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://localhost:11434',
      model: 'all-minilm',
      fetcher: async (_input, init) => {
        requestBody = String(init?.body)
        return Response.json({ embedding: [0.2, 0.8] })
      },
    })

    await expect(provider.embed('How can a team speak up?')).resolves.toEqual([
      0.2,
      0.8,
    ])
    expect(JSON.parse(requestBody)).toEqual({
      model: 'all-minilm',
      prompt: 'How can a team speak up?',
    })
  })

  it('reports an Ollama failure instead of silently switching retrieval modes', async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://localhost:11434',
      model: 'all-minilm',
      fetcher: async () => new Response('unavailable', { status: 503 }),
    })

    await expect(provider.embed('question')).rejects.toBeInstanceOf(
      OllamaEmbeddingProviderError,
    )
  })

  it('ranks relevant semantic passages, applies filters, and keeps distinct passages', async () => {
    const store = new InMemorySourceStore()
    const firstSource = { ...source, id: 'source-one', title: 'First view' }
    const secondSource = { ...source, id: 'source-two', title: 'Second view' }
    store.addSource(firstSource, [{
      id: 'chunk-one',
      sourceId: firstSource.id,
      position: 0,
      text: 'People should feel safe speaking up in team discussions.',
    }])
    store.addSource(secondSource, [{
      id: 'chunk-two',
      sourceId: secondSource.id,
      position: 0,
      text: 'Some teams prefer a strict approval process before speaking.',
    }])

    const embeddings: EmbeddingProvider = {
      async embed(text) {
        if (text.startsWith('How can people contribute')) return [1, 0]
        if (text.startsWith('People should feel safe')) return [0.98, 0.02]
        if (text.startsWith('Some teams prefer')) return [0.94, 0.06]
        return [0, 1]
      },
    }
    const retriever = new SemanticRetriever({
      sourceStore: store,
      embeddingProvider: embeddings,
      vectorStore: new InMemoryCosineVectorStore(),
      minimumScore: 0.3,
    })

    const result = await retriever.retrieve({
      question: 'How can people contribute without worrying about embarrassment?',
      limit: 2,
    })

    expect(result.results.map((item) => item.sourceId)).toEqual([
      'source-one',
      'source-two',
    ])
    expect(result.results[0].rank).toBe(1)
    expect(result.results[0].excerpt).toContain('speaking up')
    expect(result.results[0].score).toBeGreaterThan(result.results[1].score)

    const filtered = await retriever.retrieve({
      question: 'How can people contribute without worrying about embarrassment?',
      sourceId: 'source-two',
      limit: 5,
    })
    expect(filtered.results.map((item) => item.sourceId)).toEqual(['source-two'])
  })

  it('returns no evidence below the configured similarity threshold', async () => {
    const store = new InMemorySourceStore()
    store.addSource(source, [{
      id: 'chunk-one',
      sourceId: source.id,
      position: 0,
      text: 'People should feel safe speaking up in team discussions.',
    }])
    const retriever = new SemanticRetriever({
      sourceStore: store,
      embeddingProvider: {
        async embed(text) {
          return text.includes('People should') ? [1, 0] : [0, 1]
        },
      },
      vectorStore: new InMemoryCosineVectorStore(),
      minimumScore: 0.35,
    })

    const result = await retriever.retrieve({
      question: 'How do I tune a carburetor?',
    })

    expect(result.results).toEqual([])
  })
})
