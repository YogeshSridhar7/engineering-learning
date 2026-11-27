import { describe, expect, it } from 'vitest'
import {
  createSpeechInputAdapter,
  createSpeechOutputAdapter,
  prepareSpeechText,
} from './speech-adapters'
import type { SpeechRecognitionLike } from './speech-adapters'

class FixtureRecognition implements SpeechRecognitionLike {
  continuous = false
  interimResults = true
  lang = ''
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  startCalled = false
  abortCalled = false

  start() {
    this.startCalled = true
  }

  stop() {}

  abort() {
    this.abortCalled = true
  }

  recognize(event: unknown) {
    this.onresult?.(event)
  }

  fail(error: unknown) {
    this.onerror?.(error)
  }

  end() {
    this.onend?.()
  }
}

function createInputFixture() {
  const recognition = new FixtureRecognition()
  const input = createSpeechInputAdapter(() => recognition)
  const transcripts: string[] = []
  const errors: string[] = []
  input.start(
    (transcript) => transcripts.push(transcript),
    (error) => errors.push(error),
  )
  return { input, recognition, transcripts, errors }
}

describe('browser speech adapters', () => {
  it('configures one-shot recognition and returns accented speech as text', () => {
    const { recognition, transcripts, errors } = createInputFixture()

    expect(recognition.startCalled).toBe(true)
    expect(recognition.continuous).toBe(false)
    expect(recognition.interimResults).toBe(false)
    recognition.recognize({
      results: [[{ transcript: 'I’d like to practise empatía during one-to-ones.' }]],
    })

    expect(transcripts).toEqual(['I’d like to practise empatía during one-to-ones.'])
    expect(errors).toEqual([])
  })

  it('uses the browser language configured for recognition', () => {
    const recognition = new FixtureRecognition()
    const input = createSpeechInputAdapter(() => recognition, 'es-ES')
    input.start(() => {}, () => {})

    expect(recognition.lang).toBe('es-ES')
  })

  it('reports silence without submitting text', () => {
    const { recognition, transcripts, errors } = createInputFixture()
    recognition.fail({ error: 'no-speech' })

    expect(transcripts).toEqual([])
    expect(errors).toEqual(['no-speech'])
  })

  it('treats background noise without a readable transcript as no speech', () => {
    const { recognition, transcripts, errors } = createInputFixture()
    recognition.recognize({ results: [[{ transcript: '   ' }]] })

    expect(transcripts).toEqual([])
    expect(errors).toEqual(['no-speech'])
  })

  it('reports microphone permission denial without exposing browser details', () => {
    const { recognition, errors } = createInputFixture()
    recognition.fail({ error: 'not-allowed', message: 'private device detail' })

    expect(errors).toEqual(['permission-denied'])
  })

  it('ignores a recognition end caused by user interruption', () => {
    const { input, recognition, errors } = createInputFixture()
    input.stop()
    recognition.end()

    expect(recognition.abortCalled).toBe(true)
    expect(errors).toEqual([])
  })

  it('rejects malformed recognition results', () => {
    const malformed = createInputFixture()
    malformed.recognition.recognize({ results: [{ transcript: 42 }] })
    expect(malformed.errors).toEqual(['invalid-result'])
  })

  it('reports recognition service failures with a stable error code', () => {
    const { recognition, errors } = createInputFixture()
    recognition.fail({ error: 'network', message: 'private browser detail' })

    expect(errors).toEqual(['service-failure'])
  })

  it('reports an unavailable microphone separately from silence', () => {
    const { recognition, errors } = createInputFixture()
    recognition.fail({ error: 'audio-capture' })

    expect(errors).toEqual(['microphone-unavailable'])
  })

  it('speaks a short answer without raw URLs and resolves when speech ends', async () => {
    let spoken: string | undefined
    let finishSpeech: (() => void) | undefined
    const synthesis = {
      cancel() {},
      speak(text: string, onend: () => void) {
        spoken = text
        finishSpeech = onend
      },
    }
    const output = createSpeechOutputAdapter(synthesis)

    const completed = output.speak(
      'Psychological safety helps teams learn together. See https://example.com/private',
    )
    expect(spoken).toBe('Psychological safety helps teams learn together. See')
    finishSpeech?.()
    await expect(completed).resolves.toBeUndefined()
  })

  it('caps spoken text and removes URL values from long answers', () => {
    const repeatedSentence = 'A concise sentence with support. '.repeat(30)
    const speechText = prepareSpeechText(`${repeatedSentence}https://example.com`)

    expect(speechText.length).toBeLessThanOrEqual(500)
    expect(speechText).not.toContain('http')
    expect(speechText.endsWith('.')).toBe(true)
  })

  it('cancels speech on interruption and settles the pending request', async () => {
    let cancelled = false
    const output = createSpeechOutputAdapter({
      cancel() {
        cancelled = true
      },
      speak() {},
    })

    const completed = output.speak('A concise answer.')
    output.stop()

    expect(cancelled).toBe(true)
    await expect(completed).resolves.toBeUndefined()
  })
})
