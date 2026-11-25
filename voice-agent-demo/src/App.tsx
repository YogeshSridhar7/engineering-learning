import { useEffect, useState } from 'react'
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

function App() {
  const [providerRequired, setProviderRequired] = useState(false)
  const [sources, setSources] = useState<LearningSource[]>([])
  const [question, setQuestion] = useState('')
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([])
  const [retrievalMessage, setRetrievalMessage] = useState('')
  const [groundedAnswer, setGroundedAnswer] = useState<GroundedAnswer | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)

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
          <p className="eyebrow">AI voice agent console</p>
          <h1>Talk to a controlled demo agent</h1>
          <p className="lede">
            Start a browser voice session or inspect a completed conversation.
            This foundation does not place a call or create appointments.
          </p>
        </div>

        <section className="call-card" aria-labelledby="call-heading">
          <div className="card-header">
            <div>
              <p className="card-kicker">Demo agent</p>
              <h2 id="call-heading">Customer FAQ assistant</h2>
            </div>
            <span className="status-pill">
              <span className="status-dot" aria-hidden="true" />
              Ready
            </span>
          </div>

          <div className="call-visual" aria-hidden="true">
            <div className="voice-orb">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setProviderRequired(true)}
            >
              <span aria-hidden="true">↗</span>
              Make call
            </button>
            <button className="secondary-button" type="button" disabled>
              Show conversation
            </button>
          </div>

          {providerRequired && (
            <p className="provider-note" role="status">
              A browser voice provider is not configured in this foundation.
              No call was placed.
            </p>
          )}
        </section>

        <section className="capability-grid" aria-label="Demo capabilities">
          <article>
            <span className="capability-number">01</span>
            <h3>Controlled answers</h3>
            <p>Opening hours, location, and support FAQs use synthetic data.</p>
          </article>
          <article>
            <span className="capability-number">02</span>
            <h3>Traceable turns</h3>
            <p>Future call sessions will keep caller and agent turns together.</p>
          </article>
          <article>
            <span className="capability-number">03</span>
            <h3>No live side effects</h3>
            <p>The foundation does not authenticate or create appointments.</p>
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
