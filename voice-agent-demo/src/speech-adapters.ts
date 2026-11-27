export type SpeechInputError =
  | 'not-supported'
  | 'permission-denied'
  | 'microphone-unavailable'
  | 'no-speech'
  | 'invalid-result'
  | 'service-failure'

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface SpeechInputAdapter {
  start(onTranscript: (transcript: string) => void, onError: (error: SpeechInputError) => void): void
  stop(): void
}

export interface SpeechSynthesisLike {
  speak(text: string, onend: () => void, onerror: () => void): void
  cancel(): void
}

export interface SpeechOutputAdapter {
  speak(text: string): Promise<void>
  stop(): void
}

type SpeechRecognitionFactory = () => SpeechRecognitionLike | null

function readIndex(value: unknown, index: number): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  const length = Reflect.get(value, 'length')
  if (typeof length !== 'number' || length <= index) return undefined
  return Reflect.get(value, String(index))
}

function extractTranscript(event: unknown): string | null {
  if (typeof event !== 'object' || event === null) return null
  const firstResult = readIndex(Reflect.get(event, 'results'), 0)
  const firstAlternative = readIndex(firstResult, 0)
  const transcript = typeof firstAlternative === 'object' && firstAlternative !== null
    ? Reflect.get(firstAlternative, 'transcript')
    : undefined
  return typeof transcript === 'string' ? transcript.trim() : null
}

function mapRecognitionError(event: unknown): SpeechInputError {
  if (typeof event !== 'object' || event === null) return 'service-failure'
  const error = Reflect.get(event, 'error')
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'permission-denied'
  }
  if (error === 'audio-capture') return 'microphone-unavailable'
  if (error === 'no-speech') return 'no-speech'
  if (error === 'aborted') return 'service-failure'
  return 'service-failure'
}

export function createSpeechInputAdapter(
  createRecognition: SpeechRecognitionFactory,
  language = 'en-US',
): SpeechInputAdapter {
  let activeRecognition: SpeechRecognitionLike | null = null
  let stopWasRequested = false

  const stop = () => {
    const recognition = activeRecognition
    if (!recognition) return
    stopWasRequested = true
    activeRecognition = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.abort()
  }

  return {
    start(onTranscript, onError) {
      stop()
      stopWasRequested = false
      const recognition = createRecognition()
      if (!recognition) {
        onError('not-supported')
        return
      }

      activeRecognition = recognition
      recognition.lang = language
      recognition.continuous = false
      recognition.interimResults = false
      let completed = false

      const complete = () => {
        completed = true
        if (activeRecognition === recognition) activeRecognition = null
      }

      recognition.onresult = (event) => {
        if (completed) return
        complete()
        const transcript = extractTranscript(event)
        if (transcript === null) {
          onError('invalid-result')
        } else if (!transcript) {
          onError('no-speech')
        } else {
          onTranscript(transcript)
        }
      }
      recognition.onerror = (event) => {
        if (completed || stopWasRequested) return
        complete()
        onError(mapRecognitionError(event))
      }
      recognition.onend = () => {
        if (completed || stopWasRequested) return
        complete()
        onError('no-speech')
      }

      try {
        recognition.start()
      } catch (error) {
        complete()
        const name = typeof error === 'object' && error !== null
          ? Reflect.get(error, 'name')
          : undefined
        onError(
          name === 'NotAllowedError'
            ? 'permission-denied'
            : name === 'NotFoundError'
              ? 'microphone-unavailable'
              : 'service-failure',
        )
      }
    },
    stop,
  }
}

export function prepareSpeechText(text: string, maximumLength = 500): string {
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, '')
  const normalized = withoutUrls.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maximumLength) return normalized

  const shortened = normalized.slice(0, maximumLength)
  const sentenceEnd = Math.max(
    shortened.lastIndexOf('.'),
    shortened.lastIndexOf('!'),
    shortened.lastIndexOf('?'),
  )
  if (sentenceEnd >= maximumLength * 0.5) {
    return shortened.slice(0, sentenceEnd + 1).trim()
  }

  const wordEnd = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, wordEnd > 0 ? wordEnd : maximumLength).trim()}…`
}

export function createSpeechOutputAdapter(
  synthesis: SpeechSynthesisLike,
): SpeechOutputAdapter {
  let settleCurrent: (() => void) | null = null

  const stop = () => {
    const settle = settleCurrent
    if (!settle) return
    settleCurrent = null
    synthesis.cancel()
    settle()
  }

  return {
    speak(text) {
      stop()
      const spokenText = prepareSpeechText(text)
      if (!spokenText) return Promise.resolve()

      return new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (error?: Error) => {
          if (settled) return
          settled = true
          if (settleCurrent === settle) settleCurrent = null
          if (error) reject(error)
          else resolve()
        }
        const settle = () => finish()
        settleCurrent = settle

        try {
          synthesis.speak(
            spokenText,
            () => finish(),
            () => finish(new Error('Speech output failed')),
          )
        } catch {
          finish(new Error('Speech output failed'))
        }
      })
    },
    stop,
  }
}

interface BrowserSpeechWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

export function createBrowserSpeechInputAdapter(): SpeechInputAdapter {
  const speechWindow = window as BrowserSpeechWindow
  return createSpeechInputAdapter(() => {
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    return Recognition ? new Recognition() : null
  }, window.navigator.language || 'en-US')
}

export function createBrowserSpeechOutputAdapter(): SpeechOutputAdapter {
  const browserSynthesis = window.speechSynthesis
  if (!browserSynthesis) {
    return {
      async speak() {
        throw new Error('Speech output is not supported')
      },
      stop() {},
    }
  }

  return createSpeechOutputAdapter(
    {
      cancel: () => browserSynthesis.cancel(),
      speak: (text, onend, onerror) => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = onend
        utterance.onerror = onerror
        browserSynthesis.speak(utterance)
      },
    },
  )
}
