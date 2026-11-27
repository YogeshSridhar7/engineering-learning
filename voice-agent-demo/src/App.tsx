import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createBrowserSpeechInputAdapter,
  createBrowserSpeechOutputAdapter,
} from './speech-adapters'
import type {
  SpeechInputAdapter,
  SpeechInputError,
  SpeechOutputAdapter,
} from './speech-adapters'
import './App.css'

interface LearningSource {
  id: string
  title: string
  author: string
  url: string
  license: string
  retrievedAt: string
  notes: string
  chunks: number
  excerpts: string[]
}

interface RetrievalResult {
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

interface GroundedAnswer {
  speakableText: string
  sourceIds: string[]
  citations: Array<{
    sourceId: string
    sourceTitle: string
    author: string
    url: string
    chunkId: string
    excerpt: string
  }>
  confidence: 'high' | 'medium' | 'fallback'
  usedFallback: boolean
}

interface LearningSessionResponse {
  sessionId?: string
  error?: string
}

interface SessionTranscriptTurn {
  question: string
  answer: string
  evidence: GroundedAnswer['citations']
}

interface SessionTranscriptResponse {
  turns?: SessionTranscriptTurn[]
  error?: string
}

interface SessionTurn {
  id: string
  role: 'learner' | 'agent'
  text: string
  citations?: GroundedAnswer['citations']
}

type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended'

function speechInputErrorMessage(error: SpeechInputError): string {
  switch (error) {
    case 'not-supported':
      return 'Browser speech recognition is not supported. Type your question instead.'
    case 'permission-denied':
      return 'Microphone permission was denied. Allow microphone access or type your question.'
    case 'microphone-unavailable':
      return 'No microphone is available. Connect a microphone or type your question.'
    case 'no-speech':
      return 'No clear speech was detected. Try again or type your question.'
    case 'invalid-result':
      return 'Speech recognition returned an invalid result. Please try again or type your question.'
    case 'service-failure':
      return 'Browser speech recognition failed. Please try again or type your question.'
  }
}

async function fetchSessionTranscript(sessionId: string): Promise<SessionTurn[]> {
  const response = await fetch(`/api/sessions/${sessionId}/transcript`)
  const body = await response.json() as SessionTranscriptResponse
  if (!response.ok || !body.turns) {
    throw new Error(body.error ?? 'Could not load the session transcript.')
  }

  return body.turns.flatMap((turn, index) => [
    {
      id: `${sessionId}-${index}-learner`,
      role: 'learner' as const,
      text: turn.question,
    },
    {
      id: `${sessionId}-${index}-agent`,
      role: 'agent' as const,
      text: turn.answer,
      citations: turn.evidence,
    },
  ])
}

function App() {
  const [sources, setSources] = useState<LearningSource[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [completedTranscript, setCompletedTranscript] = useState<SessionTurn[] | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('ended')
  const [sessionStatus, setSessionStatus] = useState<
    'ended' | 'connecting' | 'active'
  >('ended')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const [sessionQuestion, setSessionQuestion] = useState('')
  const [sessionTurns, setSessionTurns] = useState<SessionTurn[]>([])
  const [showConversation, setShowConversation] = useState(false)
  const [question, setQuestion] = useState('')
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([])
  const [retrievalMessage, setRetrievalMessage] = useState('')
  const [groundedAnswer, setGroundedAnswer] = useState<GroundedAnswer | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const speechInputRef = useRef<SpeechInputAdapter | null>(null)
  const speechOutputRef = useRef<SpeechOutputAdapter | null>(null)
  const voiceAttemptRef = useRef(0)

  useEffect(() => {
    speechInputRef.current = createBrowserSpeechInputAdapter()
    speechOutputRef.current = createBrowserSpeechOutputAdapter()
    return () => {
      speechInputRef.current?.stop()
      speechOutputRef.current?.stop()
    }
  }, [])

  const startLearningSession = async () => {
    voiceAttemptRef.current += 1
    speechInputRef.current?.stop()
    speechOutputRef.current?.stop()
    setVoiceStatus('idle')
    setSessionStatus('connecting')
    setSessionMessage('Connecting to the learning assistant...')
    setSessionTurns([])
    setCompletedTranscript(null)
    setSessionQuestion('')
    setShowConversation(false)
    try {
      const response = await fetch('/api/sessions', { method: 'POST' })
      const body = await response.json() as LearningSessionResponse
      if (!response.ok || !body.sessionId) {
        throw new Error(body.error ?? 'Could not start a learning session.')
      }

      setSessionId(body.sessionId)
      setSessionStatus('active')
      setSessionMessage('Your learning session is active.')
    } catch (error) {
      setSessionId(null)
      setSessionStatus('ended')
      setVoiceStatus('ended')
      setSessionMessage(
        `Error: ${error instanceof Error ? error.message : 'The session service is unavailable.'}`,
      )
    }
  }

  const toggleConversation = async () => {
    if (showConversation) {
      setShowConversation(false)
      return
    }

    if (!sessionId) return
    if (sessionStatus === 'ended' && completedTranscript) {
      setSessionTurns(completedTranscript)
      setShowConversation(true)
      return
    }

    setSessionBusy(true)
    setSessionMessage('Loading the saved session transcript...')
    try {
      setSessionTurns(await fetchSessionTranscript(sessionId))
      setShowConversation(true)
      setSessionMessage('Showing the saved session transcript.')
    } catch (error) {
      setSessionMessage(
        `Error: ${error instanceof Error ? error.message : 'The session service is unavailable. Please try again.'}`,
      )
    } finally {
      setSessionBusy(false)
    }
  }

  const stopVoice = () => {
    voiceAttemptRef.current += 1
    speechInputRef.current?.stop()
    speechOutputRef.current?.stop()
    setVoiceStatus(sessionStatus === 'ended' ? 'ended' : 'idle')
    setSessionMessage(
      voiceStatus === 'thinking'
        ? 'Voice stopped. The question is still being processed.'
        : 'Voice interaction stopped.',
    )
  }

  const submitSessionQuestion = async (questionText: string, voiceAttempt?: number) => {
    if (!sessionId || !questionText || sessionBusy) return
    setSessionBusy(true)
    if (voiceAttempt !== undefined) setVoiceStatus('thinking')
    setSessionMessage('Finding an answer in your approved learning material...')
    try {
      const response = await fetch(`/api/sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText }),
      })
      const body = await response.json() as
        | { answer: GroundedAnswer }
        | { error: string }

      if (!response.ok || 'error' in body) {
        throw new Error('error' in body ? body.error : 'Could not answer that question.')
      }

      setSessionTurns((turns) => [
        ...turns,
        {
          id: `${Date.now()}-learner`,
          role: 'learner',
          text: questionText,
        },
        {
          id: `${Date.now()}-agent`,
          role: 'agent',
          text: body.answer.speakableText,
          citations: body.answer.citations,
        },
      ])
      setSessionQuestion('')
      if (voiceAttempt !== undefined && voiceAttempt === voiceAttemptRef.current) {
        setVoiceStatus('speaking')
        try {
          if (!speechOutputRef.current) throw new Error('Speech output is unavailable')
          await speechOutputRef.current.speak(body.answer.speakableText)
        } catch {
          setVoiceStatus('idle')
          setSessionMessage('Error: Speech playback failed. The answer is available as text.')
          return
        }
        if (voiceAttempt === voiceAttemptRef.current) setVoiceStatus('idle')
      }
      setSessionMessage(
        body.answer.usedFallback
          ? 'No matching evidence was found for that question.'
          : 'Answer ready, with its supporting source.',
      )
    } catch (error) {
      setSessionMessage(
        `Error: ${error instanceof Error ? error.message : 'The answer service is unavailable.'}`,
      )
      if (voiceAttempt !== undefined && voiceAttempt === voiceAttemptRef.current) {
        setVoiceStatus('idle')
      }
    } finally {
      setSessionBusy(false)
    }
  }

  const askLearningQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedQuestion = sessionQuestion.trim()
    if (!trimmedQuestion || sessionBusy) return
    await submitSessionQuestion(trimmedQuestion)
  }

  const startVoiceQuestion = () => {
    if (!sessionId || sessionStatus !== 'active' || sessionBusy) return

    voiceAttemptRef.current += 1
    const voiceAttempt = voiceAttemptRef.current
    setVoiceStatus('listening')
    setSessionMessage('Requesting microphone permission, then listening...')
    try {
      if (!speechInputRef.current) throw new Error('Speech input is unavailable')
      speechInputRef.current.start(
        (transcript) => {
          if (voiceAttempt !== voiceAttemptRef.current) return
          setSessionQuestion(transcript)
          setVoiceStatus('thinking')
          void submitSessionQuestion(transcript, voiceAttempt)
        },
        (error) => {
          if (voiceAttempt !== voiceAttemptRef.current) return
          setVoiceStatus('idle')
          setSessionMessage(`Error: ${speechInputErrorMessage(error)}`)
        },
      )
    } catch {
      setVoiceStatus('idle')
      setSessionMessage('Error: Speech input could not start. Type your question instead.')
    }
  }

  const endLearningSession = async () => {
    if (!sessionId || sessionBusy) return
    voiceAttemptRef.current += 1
    speechInputRef.current?.stop()
    speechOutputRef.current?.stop()
    setVoiceStatus('idle')
    setSessionBusy(true)
    try {
      const transcript = await fetchSessionTranscript(sessionId)
      const response = await fetch(`/api/sessions/${sessionId}/reset`, {
        method: 'POST',
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not end the learning session.')
      }
      setSessionTurns(transcript)
      setCompletedTranscript(transcript)
      setSessionStatus('ended')
      setVoiceStatus('ended')
      setSessionMessage('Learning session ended. You can still review its transcript.')
    } catch (error) {
      setSessionMessage(
        `Error: ${error instanceof Error ? error.message : 'The session service is unavailable.'}`,
      )
    } finally {
      setSessionBusy(false)
    }
  }

  useEffect(() => {
    void fetch('/api/sources')
      .then((response) => response.json() as Promise<{ sources: LearningSource[] }>)
      .then((body) => setSources(body.sources))
      .catch(() => setSources([]))
  }, [])

  const retrieveEvidence = async () => {
    if (!question.trim()) {
      setRetrievalMessage('Enter a learning question.')
      setRetrievalResults([])
      return
    }

    setRetrievalMessage('Searching approved learning sources...')
    try {
      const response = await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, limit: 3 }),
      })
      const body = await response.json() as
        | { results: RetrievalResult[] }
        | { error: string }

      if (!response.ok || 'error' in body) {
        setRetrievalMessage('error' in body ? body.error : 'Retrieval failed.')
        setRetrievalResults([])
        return
      }

      setRetrievalResults(body.results)
      setRetrievalMessage(
        body.results.length
          ? `${body.results.length} relevant evidence result${body.results.length === 1 ? '' : 's'}`
          : 'I could not find enough evidence in the selected learning material.',
      )
    } catch {
      setRetrievalMessage('The retrieval service is unavailable. Please try again.')
      setRetrievalResults([])
    }
  }

  const answerQuestion = async () => {
    if (!question.trim()) {
      setRetrievalMessage('Enter a learning question.')
      setGroundedAnswer(null)
      return
    }

    setAnswerLoading(true)
    setRetrievalMessage('Creating a grounded answer...')
    try {
      const response = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, limit: 3 }),
      })
      const body = await response.json() as
        | { answer: GroundedAnswer; retrieval: { results: RetrievalResult[] } }
        | { error: string }

      if (!response.ok || 'error' in body) {
        setRetrievalMessage('error' in body ? body.error : 'Answer generation failed.')
        setGroundedAnswer(null)
        setRetrievalResults([])
        return
      }

      setGroundedAnswer(body.answer)
      setRetrievalResults(body.retrieval.results)
      setRetrievalMessage(
        body.answer.usedFallback
          ? body.answer.speakableText
          : `Grounded answer · ${body.answer.confidence} confidence`,
      )
    } catch {
      setRetrievalMessage('The answer service is unavailable. Please try again.')
      setGroundedAnswer(null)
    } finally {
      setAnswerLoading(false)
    }
  }

  const voiceStatusLabel = voiceStatus === 'listening'
    ? 'Listening'
    : voiceStatus === 'thinking'
      ? 'Thinking'
      : voiceStatus === 'speaking'
        ? 'Speaking'
        : voiceStatus === 'ended'
          ? 'Ended'
          : 'Ready'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="VoiceDesk demo">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VoiceDesk</span>
        </div>
        <span className="demo-badge">Synthetic demo</span>
      </header>

      <section className="workspace">
        <div className="hero-copy">
          <p className="eyebrow">Grounded learning assistant</p>
          <h1>Learn by asking, one question at a time</h1>
          <p className="lede">
            Practice leadership communication and explore topics using answers
            grounded in the approved learning material below.
          </p>
        </div>

        <section className="call-card" aria-labelledby="call-heading">
          <div className="card-header">
            <div>
              <p className="card-kicker">Text learning session</p>
              <h2 id="call-heading">Your learning conversation</h2>
            </div>
            <span className={`status-pill session-state session-state-${sessionStatus}`}>
              <span className="status-dot" aria-hidden="true" />
              {sessionStatus === 'connecting'
                ? 'Connecting'
                : sessionStatus === 'active'
                  ? 'Active'
                  : 'Ended'}
            </span>
          </div>

          <div className="call-visual" aria-hidden="true">
            <div className="learning-orb"><span aria-hidden="true">?</span></div>
          </div>

          <div className="actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => void startLearningSession()}
              disabled={sessionStatus === 'connecting' || sessionBusy || sessionStatus === 'active'}
            >
              {sessionStatus === 'connecting'
                ? 'Connecting...'
                : sessionStatus === 'active'
                  ? 'Session active'
                  : sessionId
                    ? 'Start new learning session'
                    : 'Start learning session'}
            </button>
            {sessionStatus === 'active' && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => void endLearningSession()}
                disabled={sessionBusy}
              >
                End session
              </button>
            )}
            {sessionTurns.length > 0 && (
              <button
                className="secondary-button"
                type="button"
                aria-expanded={showConversation}
                aria-controls="conversation-transcript"
                onClick={() => void toggleConversation()}
                disabled={sessionBusy}
              >
                {showConversation ? 'Hide conversation' : 'Show conversation'}
              </button>
            )}
          </div>

          {sessionStatus === 'active' && (
            <>
            <form className="session-question-form" onSubmit={(event) => void askLearningQuestion(event)}>
              <label htmlFor="session-question">Ask a learning question</label>
              <textarea
                id="session-question"
                value={sessionQuestion}
                onChange={(event) => setSessionQuestion(event.target.value)}
                placeholder="How can I communicate a decision clearly?"
                maxLength={1000}
                rows={3}
                required
                disabled={sessionBusy}
              />
              <div className="session-form-footer">
                <span>{sessionQuestion.length}/1000</span>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={sessionBusy || !sessionQuestion.trim()}
                >
                  {sessionBusy ? 'Working...' : 'Ask question'}
                </button>
              </div>
            </form>
            <div className="voice-controls">
              <button
                className="secondary-button"
                type="button"
                onClick={startVoiceQuestion}
                disabled={sessionBusy || voiceStatus !== 'idle'}
              >
                {voiceStatus === 'listening' ? 'Listening...' : 'Ask by voice'}
              </button>
              {voiceStatus !== 'idle' && voiceStatus !== 'ended' && (
                <button className="secondary-button" type="button" onClick={stopVoice}>
                  Stop voice
                </button>
              )}
            </div>
            </>
          )}

          <p className={`voice-status voice-status-${voiceStatus}`} role="status" aria-live="polite">
            Voice: {voiceStatusLabel}
            {voiceStatus === 'listening' && ' · Microphone permission may be requested'}
          </p>

          <p
            className="session-message"
            role={sessionMessage.startsWith('Error:') ? 'alert' : 'status'}
            aria-live={sessionMessage.startsWith('Error:') ? 'assertive' : 'polite'}
          >
            {sessionMessage}
          </p>

          {showConversation && (
            <section
              className="conversation-transcript"
              id="conversation-transcript"
              aria-labelledby="transcript-heading"
            >
              <div className="transcript-header">
                <div>
                  <p className="card-kicker">Session transcript</p>
                  <h3 id="transcript-heading">
                    {sessionStatus === 'active' ? 'Conversation so far' : 'Completed conversation'}
                  </h3>
                </div>
                <span>{sessionTurns.length / 2} turns</span>
              </div>
              <ol className="transcript-turns" aria-label="Conversation transcript">
                {sessionTurns.map((turn) => (
                  <li className={`transcript-turn transcript-turn-${turn.role}`} key={turn.id}>
                    <p className="turn-speaker">
                      {turn.role === 'learner' ? 'You' : 'Learning assistant'}
                    </p>
                    <p className="turn-text">{turn.text}</p>
                    {turn.citations?.map((citation) => (
                      <article className="turn-citation" key={citation.chunkId}>
                        <a href={citation.url} target="_blank" rel="noreferrer">
                          {citation.sourceTitle}
                        </a>
                        <blockquote>{citation.excerpt}</blockquote>
                      </article>
                    ))}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>

        <section className="capability-grid" aria-label="Demo capabilities">
          <article>
            <span className="capability-number">01</span>
            <h3>Source-grounded</h3>
            <p>Answers use retrieved excerpts and show where the information came from.</p>
          </article>
          <article>
            <span className="capability-number">02</span>
            <h3>Follow-up questions</h3>
            <p>Recent evidence-backed context stays within your learning session.</p>
          </article>
          <article>
            <span className="capability-number">03</span>
            <h3>Browser voice</h3>
            <p>Speak a question and hear the grounded answer using your browser’s speech tools.</p>
          </article>
        </section>

        <section className="learning-sources" aria-labelledby="sources-heading">
          <div className="sources-heading">
            <div>
              <p className="card-kicker">Approved source set</p>
              <h2 id="sources-heading">Leadership learning material</h2>
            </div>
            <span className="source-count">{sources.length} sources</span>
          </div>

          <div className="source-grid">
            {sources.map((source) => (
              <article className="source-card" key={source.id}>
                <p className="source-author">{source.author}</p>
                <h3>{source.title}</h3>
                <p className="source-note">{source.notes}</p>
                {source.excerpts.slice(0, 1).map((excerpt) => (
                  <blockquote key={excerpt}>{excerpt}</blockquote>
                ))}
                <div className="source-footer">
                  <a href={source.url} target="_blank" rel="noreferrer">
                    View source
                  </a>
                  <span>{source.chunks} excerpt chunk</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="retrieval-panel" aria-labelledby="retrieval-heading">
          <div>
            <p className="card-kicker">Retrieval check</p>
            <h2 id="retrieval-heading">Ask for evidence</h2>
          </div>
          <div className="retrieval-form">
            <label htmlFor="learning-question">Learning question</label>
            <div className="retrieval-input-row">
              <input
                id="learning-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How does psychological safety help a team?"
              />
              <button type="button" onClick={retrieveEvidence}>
                Search sources
              </button>
              <button type="button" onClick={answerQuestion} disabled={answerLoading}>
                {answerLoading ? 'Answering...' : 'Get grounded answer'}
              </button>
            </div>
          </div>
          <p className="retrieval-message" role="status">{retrievalMessage}</p>
          {groundedAnswer && (
            <article className="grounded-answer" aria-label="Grounded answer">
              <p className="card-kicker">Grounded answer</p>
              <p>{groundedAnswer.speakableText}</p>
              {groundedAnswer.citations.length > 0 && (
                <div className="citation-list">
                  {groundedAnswer.citations.map((citation) => (
                    <a
                      key={citation.chunkId}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {citation.sourceTitle}
                    </a>
                  ))}
                </div>
              )}
            </article>
          )}
          {retrievalResults.length > 0 && (
            <div className="retrieval-results">
              {retrievalResults.map((result) => (
                <article key={result.chunkId}>
                  <div className="retrieval-result-header">
                    <strong>Rank {result.rank}</strong>
                    <span>Score {result.score}</span>
                  </div>
                  <h3>{result.sourceTitle}</h3>
                  <blockquote>{result.excerpt}</blockquote>
                  <div className="source-footer">
                    <a href={result.url} target="_blank" rel="noreferrer">
                      View source
                    </a>
                    <span>{result.matchedTerms.join(', ')}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
