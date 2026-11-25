import { randomUUID } from 'node:crypto'
import type { RetrievalResult } from './retrieval.js'

export interface SessionEvidence {
  sourceId: string
  sourceTitle: string
  author: string
  url: string
  chunkId: string
  excerpt: string
}

export interface LearningSessionTurn {
  question: string
  answer: string
  evidence: SessionEvidence[]
}

export interface LearningSession {
  id: string
  createdAt: string
  lastActivityAt: number
  turns: LearningSessionTurn[]
}

export interface LearningSessionContext {
  question: string
  evidence: SessionEvidence[]
}

const SESSION_TTL_MS = 60 * 60 * 1000
const MAX_ACTIVE_SESSIONS = 500
const MAX_STORED_TURNS = 20
const MAX_CONTEXT_TURNS = 3

export class LearningSessionStore {
  private readonly sessions = new Map<string, LearningSession>()

  create(now = Date.now()): LearningSession {
    this.removeExpiredSessions(now)
    if (this.sessions.size >= MAX_ACTIVE_SESSIONS) {
      throw new Error('The active learning-session limit has been reached')
    }

    const session: LearningSession = {
      id: randomUUID(),
      createdAt: new Date(now).toISOString(),
      lastActivityAt: now,
      turns: [],
    }
    this.sessions.set(session.id, session)
    return session
  }

  get(sessionId: string, now = Date.now()): LearningSession | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    if (now - session.lastActivityAt >= SESSION_TTL_MS) {
      this.sessions.delete(sessionId)
      return undefined
    }
    session.lastActivityAt = now
    return session
  }

  getContext(session: LearningSession): LearningSessionContext[] {
    return session.turns
      .slice(-MAX_CONTEXT_TURNS)
      .filter((turn) => turn.evidence.length > 0)
      .map((turn) => ({
        question: turn.question,
        evidence: turn.evidence,
      }))
  }

  recordTurn(
    session: LearningSession,
    turn: LearningSessionTurn,
    now = Date.now(),
  ): number {
    session.turns.push(turn)
    if (session.turns.length > MAX_STORED_TURNS) {
      session.turns.splice(0, session.turns.length - MAX_STORED_TURNS)
    }
    session.lastActivityAt = now
    return session.turns.length
  }

  reset(session: LearningSession, now = Date.now()): void {
    session.turns = []
    session.lastActivityAt = now
  }

  private removeExpiredSessions(now: number): void {
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt >= SESSION_TTL_MS) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

export function toSessionEvidence(
  results: RetrievalResult[],
): SessionEvidence[] {
  const topResult = results[0]
  return topResult
    ? [{
        sourceId: topResult.sourceId,
        sourceTitle: topResult.sourceTitle,
        author: topResult.author,
        url: topResult.url,
        chunkId: topResult.chunkId,
        excerpt: topResult.excerpt,
      }]
    : []
}
