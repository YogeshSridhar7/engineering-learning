import { describe, expect, it } from 'vitest'
import {
  InMemorySourceStore,
  ingestLeadershipSources,
  normalizeSourceText,
  purgeSource,
  chunkSourceText,
  validateSourcePolicy,
  PlainTextExtractor,
} from './source-ingestion.js'

describe('learning source ingestion', () => {
  it('ingests free leadership sources and preserves source metadata', () => {
    const store = new InMemorySourceStore()

    const result = ingestLeadershipSources(store)

    expect(result.sources).toBeGreaterThanOrEqual(2)
    expect(store.listSources()).toHaveLength(result.sources)
    expect(store.listSources().every((source) => source.license !== '')).toBe(true)
    expect(store.listSources().every((source) => source.url.startsWith('https://'))).toBe(true)
  })

  it('normalizes text and rejects empty content', () => {
    expect(normalizeSourceText('  Clear  communication\n\n matters.  '))
      .toBe('Clear communication matters.')
    expect(normalizeSourceText('   \n ')).toBe('')
  })

  it('purges all chunks belonging to one source', () => {
    const store = new InMemorySourceStore()
    ingestLeadershipSources(store)
    const source = store.listSources()[0]

    const removed = purgeSource(store, source.id)

    expect(removed).toBeGreaterThan(0)
    expect(store.listSources().some((item) => item.id === source.id)).toBe(false)
    expect(store.listChunks(source.id)).toHaveLength(0)
  })

  it('rejects an invalid chunk size and deduplicates repeated text', () => {
    expect(() => chunkSourceText('repeat', 'test', 0)).toThrow(
      'maxCharacters must be greater than zero',
    )

    const chunks = chunkSourceText('Repeat. Repeat.', 'test', 700)
    expect(chunks).toHaveLength(1)
  })

  it('rejects prohibited source content and unsafe URLs', () => {
    expect(() => validateSourcePolicy({
      url: 'https://example.com/article?utm_source=test',
      license: 'Public',
      text: 'Synthetic text',
    })).toThrow('tracking parameters')

    expect(() => validateSourcePolicy({
      url: 'https://example.com/article',
      license: 'Public',
      text: 'EMPLOYER_CONFIDENTIAL project details',
    })).toThrow('prohibited sensitive content')

    expect(new PlainTextExtractor().extract('  Short   original  notes. '))
      .toBe('Short original notes.')
  })
})
