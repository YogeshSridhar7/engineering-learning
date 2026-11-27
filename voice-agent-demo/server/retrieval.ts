import type { InMemorySourceStore, LearningChunk } from './source-ingestion.js'

export interface RetrievalRequest {
  question: string
  sourceId?: string
  limit?: number
}

export interface RetrievalResult {
  rank: number
  chunkId: string
  sourceId: string
  sourceTitle: string
  author: string
  url: string
  excerpt: string
  score: number
  matchedTerms: string[]
}

export interface RetrievalResponse {
  question: string
  sourceId?: string
  limit: number
  results: RetrievalResult[]
}

export interface RetrievalAdapter {
  retrieve(request: RetrievalRequest): RetrievalResponse | Promise<RetrievalResponse>
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'for', 'how',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to',
  'what', 'way', 'with',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 2 && !STOP_WORDS.has(term)) ?? []
}

function uniqueTerms(text: string): string[] {
  return [...new Set(tokenize(text))]
}

function isApproximateTerm(left: string, right: string): boolean {
  if (left.length < 6 || right.length < 6) return false
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  let differences = 0
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  let shorterIndex = 0
  for (const character of longer) {
    if (shorter[shorterIndex] === character) shorterIndex++
    else differences++
    if (differences > 1) return false
  }
  return true
}

export class LexicalRetriever implements RetrievalAdapter {
  constructor(private readonly store: InMemorySourceStore) {}

  retrieve(request: RetrievalRequest): RetrievalResponse {
    const limit = request.limit ?? 3
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new RangeError('limit must be between 1 and 10')
    }

    const question = request.question.trim()
    if (!question) {
      throw new Error('question must not be empty')
    }

    const questionTerms = uniqueTerms(question)
    const candidates: Array<{ chunk: LearningChunk; score: number; matched: string[] }> = []

    for (const source of this.store.listSources()) {
      if (request.sourceId && source.id !== request.sourceId) continue
      for (const chunk of this.store.listChunks(source.id)) {
        const chunkTerms = new Set(uniqueTerms(chunk.text))
        const matched = questionTerms.filter((term) =>
          chunkTerms.has(term) ||
          [...chunkTerms].some((chunkTerm) =>
            chunkTerm.includes(term) ||
            term.includes(chunkTerm) ||
            isApproximateTerm(chunkTerm, term),
          ),
        )
        if (matched.length === 0) continue

        const uniqueMatchScore = matched.length
        const coverage = uniqueMatchScore / Math.max(questionTerms.length, 1)
        const score = Number((coverage * 10 + uniqueMatchScore).toFixed(4))
        candidates.push({ chunk, score, matched })
      }
    }

    candidates.sort((left, right) =>
      right.score - left.score ||
      left.chunk.sourceId.localeCompare(right.chunk.sourceId) ||
      left.chunk.position - right.chunk.position,
    )

    const results = candidates.slice(0, limit).flatMap((candidate, index) => {
      const source = this.store.listSources().find(
        (item) => item.id === candidate.chunk.sourceId,
      )
      if (!source || candidate.score < 2.5) return []
      return [{
        rank: index + 1,
        chunkId: candidate.chunk.id,
        sourceId: source.id,
        sourceTitle: source.title,
        author: source.author,
        url: source.url,
        excerpt: candidate.chunk.text,
        score: candidate.score,
        matchedTerms: [...new Set(candidate.matched)],
      }]
    }).map((result, index) => ({
      ...result,
      rank: index + 1,
    }))

    return {
      question,
      sourceId: request.sourceId,
      limit,
      results,
    }
  }
}
