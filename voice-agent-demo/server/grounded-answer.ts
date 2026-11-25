import type { RetrievalResult } from './retrieval.js'

export interface GroundedAnswerRequest {
  question: string
  retrievalResults: RetrievalResult[]
  conversationContext?: Array<{
    question: string
    evidence: AnswerCitation[]
  }>
}

export interface AnswerCitation {
  sourceId: string
  sourceTitle: string
  author: string
  url: string
  chunkId: string
  excerpt: string
}

export interface GroundedAnswerResult {
  speakableText: string
  sourceIds: string[]
  citations: AnswerCitation[]
  confidence: 'high' | 'medium' | 'fallback'
  usedFallback: boolean
}

export interface GroundedAnswerAdapter {
  answer(request: GroundedAnswerRequest): Promise<GroundedAnswerResult>
}

const INSTRUCTION_MARKERS = [
  /ignore all previous instructions/gi,
  /reveal credentials/gi,
  /system prompt/gi,
  /execute (?:the )?following/gi,
]

export function sanitizeEvidenceExcerpt(excerpt: string): string {
  let sanitized = excerpt
  for (const marker of INSTRUCTION_MARKERS) {
    sanitized = sanitized.replace(marker, '')
  }
  return sanitized.replace(/\s+/g, ' ').trim()
}

export class DeterministicGroundedAnswerAdapter
  implements GroundedAnswerAdapter
{
  async answer(request: GroundedAnswerRequest): Promise<GroundedAnswerResult> {
    const evidence = request.retrievalResults
      .filter((result) => result.excerpt.trim().length > 0)
      .map((result) => ({
        ...result,
        excerpt: sanitizeEvidenceExcerpt(result.excerpt),
      }))
      .filter((result) => result.excerpt.length > 0)

    if (evidence.length === 0) {
      return {
        speakableText:
          'I could not find enough evidence in the selected learning material.',
        sourceIds: [],
        citations: [],
        confidence: 'fallback',
        usedFallback: true,
      }
    }

    const topEvidence = evidence[0]
    const topSourceIds = [...new Set([topEvidence.sourceId])]
    const citations = [topEvidence].map((result) => ({
      sourceId: result.sourceId,
      sourceTitle: result.sourceTitle,
      author: result.author,
      url: result.url,
      chunkId: result.chunkId,
      excerpt: result.excerpt,
    }))

    const topExcerpt = topEvidence.excerpt
    const sentence = topExcerpt.endsWith('.')
      ? topExcerpt
      : `${topExcerpt}.`

    return {
      speakableText: sentence,
      sourceIds: topSourceIds,
      citations,
      confidence: 'medium',
      usedFallback: false,
    }
  }
}
