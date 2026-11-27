import type {
  InMemorySourceStore,
  LearningChunk,
  LearningSource,
} from './source-ingestion.js'
import type {
  RetrievalAdapter,
  RetrievalRequest,
  RetrievalResponse,
  RetrievalResult,
} from './retrieval.js'

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}

export interface IndexedPassage extends RetrievalResult {
  vector: number[]
}

export interface VectorStore {
  get(chunkId: string): IndexedPassage | undefined
  upsert(passage: IndexedPassage): void
  retain(chunkIds: Set<string>): void
  search(vector: number[], options: {
    limit: number
    sourceId?: string
    minimumScore: number
  }): RetrievalResult[]
}

export interface OllamaEmbeddingOptions {
  baseUrl: string
  model: string
  fetcher?: typeof fetch
}

interface OllamaEmbeddingResponse {
  embedding?: unknown
}

export class OllamaEmbeddingProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OllamaEmbeddingProviderError'
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly fetcher: typeof fetch
  private readonly endpoint: string

  constructor(private readonly options: OllamaEmbeddingOptions) {
    if (!options.model.trim()) {
      throw new Error('OLLAMA_EMBEDDING_MODEL is required')
    }

    const baseUrl = new URL(options.baseUrl)
    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      '::1',
      'host.docker.internal',
    ]
    if (
      baseUrl.protocol !== 'http:' ||
      !allowedHosts.includes(baseUrl.hostname)
    ) {
      throw new Error(
        'OLLAMA_BASE_URL must use HTTP on localhost or host.docker.internal',
      )
    }

    this.endpoint = `${baseUrl.origin}/api/embeddings`
    this.fetcher = options.fetcher ?? fetch
  }

  async embed(text: string): Promise<number[]> {
    let response: Response
    try {
      response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          prompt: text,
        }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new OllamaEmbeddingProviderError(
        'Could not connect to the local Ollama embedding service',
        { cause: error },
      )
    }

    if (!response.ok) {
      throw new OllamaEmbeddingProviderError(
        `Ollama embedding request failed with HTTP ${response.status}`,
      )
    }

    let body: OllamaEmbeddingResponse
    try {
      body = await response.json() as OllamaEmbeddingResponse
    } catch (error) {
      throw new OllamaEmbeddingProviderError(
        'Ollama returned an invalid embedding response',
        { cause: error },
      )
    }

    if (
      !Array.isArray(body.embedding) ||
      body.embedding.length === 0 ||
      body.embedding.length > 8192 ||
      !body.embedding.every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    ) {
      throw new OllamaEmbeddingProviderError(
        'Ollama returned an invalid embedding vector',
      )
    }

    const vector = body.embedding as number[]
    if (vector.every((value) => value === 0)) {
      throw new OllamaEmbeddingProviderError(
        'Ollama returned an empty embedding vector',
      )
    }
    return vector
  }
}

export class InMemoryCosineVectorStore implements VectorStore {
  private readonly passages = new Map<string, IndexedPassage>()

  get(chunkId: string): IndexedPassage | undefined {
    return this.passages.get(chunkId)
  }

  upsert(passage: IndexedPassage): void {
    this.passages.set(passage.chunkId, passage)
  }

  retain(chunkIds: Set<string>): void {
    for (const chunkId of this.passages.keys()) {
      if (!chunkIds.has(chunkId)) this.passages.delete(chunkId)
    }
  }

  search(
    vector: number[],
    options: { limit: number; sourceId?: string; minimumScore: number },
  ): RetrievalResult[] {
    return [...this.passages.values()]
      .filter((passage) => !options.sourceId || passage.sourceId === options.sourceId)
      .map((passage) => ({
        passage,
        score: cosineSimilarity(vector, passage.vector),
      }))
      .filter((item) => item.score >= options.minimumScore)
      .sort((left, right) =>
        right.score - left.score ||
        left.passage.sourceId.localeCompare(right.passage.sourceId) ||
        left.passage.chunkId.localeCompare(right.passage.chunkId),
      )
      .slice(0, options.limit)
      .map(({ passage, score }, index) => ({
        rank: index + 1,
        chunkId: passage.chunkId,
        sourceId: passage.sourceId,
        sourceTitle: passage.sourceTitle,
        author: passage.author,
        url: passage.url,
        excerpt: passage.excerpt,
        score: Number(score.toFixed(4)),
        matchedTerms: [],
      }))
  }
}

export class SemanticRetriever implements RetrievalAdapter {
  constructor(private readonly options: {
    sourceStore: InMemorySourceStore
    embeddingProvider: EmbeddingProvider
    vectorStore: VectorStore
    minimumScore?: number
  }) {
    const minimumScore = options.minimumScore ?? 0.25
    if (!Number.isFinite(minimumScore) || minimumScore < -1 || minimumScore > 1) {
      throw new RangeError('minimumScore must be between -1 and 1')
    }
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResponse> {
    const limit = request.limit ?? 3
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new RangeError('limit must be between 1 and 10')
    }

    const question = request.question.trim()
    if (!question) {
      throw new Error('question must not be empty')
    }

    const sources = this.options.sourceStore.listSources()
    const allChunks = sources.flatMap((source) =>
      this.options.sourceStore.listChunks(source.id).map((chunk) => ({
        source,
        chunk,
      })),
    )
    this.options.vectorStore.retain(
      new Set(allChunks.map(({ chunk }) => chunk.id)),
    )

    for (const { source, chunk } of allChunks) {
      await this.indexChunk(source, chunk)
    }

    const questionVector = await this.options.embeddingProvider.embed(question)
    const results = this.options.vectorStore.search(questionVector, {
      limit,
      sourceId: request.sourceId,
      minimumScore: this.options.minimumScore ?? 0.25,
    })

    return {
      question,
      sourceId: request.sourceId,
      limit,
      results,
    }
  }

  private async indexChunk(
    source: LearningSource,
    chunk: LearningChunk,
  ): Promise<void> {
    const existing = this.options.vectorStore.get(chunk.id)
    if (existing?.excerpt === chunk.text) {
      if (
        existing.sourceTitle !== source.title ||
        existing.author !== source.author ||
        existing.url !== source.url
      ) {
        this.options.vectorStore.upsert({
          ...existing,
          sourceTitle: source.title,
          author: source.author,
          url: source.url,
        })
      }
      return
    }

    const vector = await this.options.embeddingProvider.embed(chunk.text)
    this.options.vectorStore.upsert({
      rank: 0,
      chunkId: chunk.id,
      sourceId: source.id,
      sourceTitle: source.title,
      author: source.author,
      url: source.url,
      excerpt: chunk.text,
      score: 0,
      matchedTerms: [],
      vector,
    })
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) {
    throw new OllamaEmbeddingProviderError(
      'Embedding vectors have inconsistent dimensions',
    )
  }

  let dotProduct = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index]
    const rightValue = right[index]
    if (leftValue === undefined || rightValue === undefined) {
      throw new OllamaEmbeddingProviderError(
        'Embedding vector contains a missing value',
      )
    }
    dotProduct += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    throw new OllamaEmbeddingProviderError(
      'Embedding vector magnitude must be greater than zero',
    )
  }
  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

export function createSemanticRetriever(
  sourceStore: InMemorySourceStore,
  environment: Record<string, string | undefined> = process.env,
): SemanticRetriever {
  const provider = environment.RETRIEVAL_PROVIDER ?? 'ollama'
  if (provider !== 'ollama') {
    throw new Error(`Unsupported RETRIEVAL_PROVIDER: ${provider}`)
  }

  const minimumScore = Number(environment.RETRIEVAL_MINIMUM_SCORE ?? 0.25)
  return new SemanticRetriever({
    sourceStore,
    embeddingProvider: new OllamaEmbeddingProvider({
      baseUrl: environment.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: environment.OLLAMA_EMBEDDING_MODEL ?? 'all-minilm',
    }),
    vectorStore: new InMemoryCosineVectorStore(),
    minimumScore,
  })
}
