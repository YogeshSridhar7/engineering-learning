export interface LearningSource {
  id: string
  title: string
  author: string
  url: string
  license: string
  retrievedAt: string
  notes: string
}

export interface LearningChunk {
  id: string
  sourceId: string
  text: string
  position: number
}

export class InMemorySourceStore {
  private readonly sources = new Map<string, LearningSource>()
  private readonly chunks = new Map<string, LearningChunk[]>()

  addSource(source: LearningSource, chunks: LearningChunk[]): void {
    this.sources.set(source.id, source)
    this.chunks.set(source.id, [...chunks])
  }

  listSources(): LearningSource[] {
    return [...this.sources.values()]
  }

  listChunks(sourceId: string): LearningChunk[] {
    return [...(this.chunks.get(sourceId) ?? [])]
  }

  hasSource(sourceId: string): boolean {
    return this.sources.has(sourceId)
  }

  purgeSource(sourceId: string): number {
    const chunkCount = this.chunks.get(sourceId)?.length ?? 0
    this.sources.delete(sourceId)
    this.chunks.delete(sourceId)
    return chunkCount
  }
}

export class PlainTextExtractor {
  extract(text: string): string {
    const normalized = normalizeSourceText(text)
    if (!normalized) {
      throw new Error('Source text must not be empty')
    }
    return normalized
  }
}

export function validateSourcePolicy(input: {
  url: string
  license: string
  text: string
}): void {
  if (!input.url.startsWith('https://')) {
    throw new Error('Source URL must use HTTPS')
  }

  const url = new URL(input.url)
  if (url.username || url.password || url.search) {
    throw new Error('Source URL must not contain credentials or tracking parameters')
  }

  const prohibitedMarkers = [
    'EMPLOYER_CONFIDENTIAL',
    'PERSONAL_HEALTH_INFORMATION',
  ]
  const uppercaseText = input.text.toUpperCase()
  if (
    prohibitedMarkers.some((marker) => uppercaseText.includes(marker)) ||
    /(?:api[_-]?key|auth[_-]?token|password)\s*[:=]/i.test(input.text)
  ) {
    throw new Error('Source text contains prohibited sensitive content')
  }

  if (!input.license.trim()) {
    throw new Error('A licensing or usage basis is required')
  }
}

export function normalizeSourceText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function chunkSourceText(
  text: string,
  sourceId: string,
  maxCharacters = 700,
): LearningChunk[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
    throw new RangeError('maxCharacters must be greater than zero')
  }
  const normalized = normalizeSourceText(text)
  if (!normalized) return []

  const chunks: LearningChunk[] = []
  const seen = new Set<string>()
  let position = 0
  while (position < normalized.length) {
    let end = Math.min(position + maxCharacters, normalized.length)
    if (end < normalized.length) {
      const sentenceBoundary = normalized.lastIndexOf('. ', end)
      if (sentenceBoundary > position) end = sentenceBoundary + 1
    }

    const chunkText = normalized.slice(position, end).trim()
    if (chunkText && !seen.has(chunkText)) {
      seen.add(chunkText)
      chunks.push({
      id: `${sourceId}-chunk-${chunks.length + 1}`,
      sourceId,
      text: chunkText,
      position: chunks.length,
      })
    }
    position = end
  }
  return chunks
}

export function ingestLeadershipSources(store: InMemorySourceStore): {
  sources: number
  chunks: number
} {
  const retrievedAt = '2026-11-21'
  const sources: Array<{ source: LearningSource; text: string }> = [
    {
      source: {
        id: 'google-project-aristotle',
        title: 'Google re:Work — The Five Keys to a Successful Team',
        author: 'Google re:Work',
        url: 'https://rework.withgoogle.com/intl/en/guides/understanding-team-effectiveness/',
        license: 'Public web source; short original summary and citation only',
        retrievedAt,
        notes: 'Practice psychological safety, dependability, structure and clarity, meaning, and impact.',
      },
      text:
        'Psychological safety helps team members speak up, ask questions, admit mistakes, and offer ideas without fear of humiliation. '
        + 'A useful leadership practice is to respond with curiosity, invite quieter voices, and frame an admission of uncertainty as an opportunity to learn. '
        + 'Dependability means teammates know they can rely on agreed commitments. Structure and clarity help people understand roles, plans, and goals. '
        + 'Meaning and impact connect the work to why it matters and to the difference the team is making.',
    },
    {
      source: {
        id: 'atlassian-effective-feedback',
        title: 'Atlassian Team Playbook — Constructive Feedback',
        author: 'Atlassian',
        url: 'https://www.atlassian.com/team-playbook',
        license: 'Public web source; short original summary and citation only',
        retrievedAt,
        notes: 'Practice specific, observable, timely, and respectful feedback.',
      },
      text:
        'Effective feedback connects an observable situation to its impact and invites a conversation. '
        + 'Use a specific example rather than a personality judgment. Explain the impact on the team or goal, listen to the other person, and agree on a next step. '
        + 'Useful leadership language is calm and direct: describe what happened, explain why it matters, ask for perspective, and confirm an action.',
    },
  ]

  let chunks = 0
  for (const entry of sources) {
    const chunksForSource = chunkSourceText(entry.text, entry.source.id)
    store.addSource(entry.source, chunksForSource)
    chunks += chunksForSource.length
  }
  return { sources: sources.length, chunks }
}

export function purgeSource(store: InMemorySourceStore, sourceId: string): number {
  return store.purgeSource(sourceId)
}
