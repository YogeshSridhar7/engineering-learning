# Voice Agent Demo Architecture

## Purpose

This is the reference architecture for a learning-grade FAQ voice agent with
two entry channels: a browser call and a telephone call. It is designed to
grow toward a production system without coupling conversation behavior,
provider integration, or user interface code together.

## Alexa comparison

Alexa and this project both convert speech to text, reason over a request,
generate speech, and maintain a short interaction context. The differences are:

| Concern | Alexa-style consumer assistant | This demo |
|---|---|---|
| Product scope | General-purpose assistant and ecosystem | One custom FAQ conversation |
| Knowledge | Broad cloud capabilities | Predefined synthetic FAQ |
| Control | Managed by the assistant platform | You control the backend, rules, logs, and tests |
| Voice and telephony | Owned by the consumer assistant ecosystem | Browser call or Twilio ConversationRelay |
| Testing | Mostly provider/platform-managed | Text-level, API, browser, provider-adapter, and manual call |
| Side effects | Many integrations | No side effects in the MVP |
| Production ownership | Amazon-operated | Self-operated after provider integration |

The key difference is observability and control: this agent exposes one
deterministic conversation service that can be tested without making a call.

## Core architecture

```text
Browser UI                         PSTN/phone caller
Make Call / Show Conversation      ordinary telephone
       |                                  |
       | WebRTC / browser session         | PSTN
       v                                  v
+--------------------+             +-----------------------+
| Browser Voice      |             | Twilio Programmable   |
| Adapter            |             | Voice                 |
+----------+---------+             +----------+------------+
           |                                  |
           |              ConversationRelay   |
           +------------------+---------------+
                              |
                              v
                 +----------------------------+
                 | Public API / WebSocket     |
                 | Gateway                    |
                 | signature/auth/rate limits |
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | Voice Orchestrator         |
                 | session + turn state       |
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | FAQ / Intent Engine        |
                 | curated answer match       |
                 | safe fallback              |
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | Response + Evidence        |
                 | turn log / trace / metrics |
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | STT / TTS Adapter          |
                 | provider managed by relay  |
                 +----------------------------+
```

## Main components

### Browser demo

- React or framework-native TypeScript UI.
- `Make call` starts a browser provider session.
- `Show conversation` is available only after the session reaches a terminal
  state.
- The UI receives call status and the redacted conversation through backend
  APIs.
- The UI never receives provider secrets or raw provider credentials.

### API gateway

- Validates content, origin, session identity, and payload size.
- Applies rate limits and abuse protection.
- Rejects malformed provider callbacks.
- Adds trace/correlation IDs to each call and turn.

### Voice orchestrator

- Owns call state: connecting, active, ended, failed.
- Creates isolated session state.
- Converts partial or final STT text into a turn.
- Prevents duplicate turn processing.
- Produces a structured response and call-ending result.

### FAQ engine

- Uses curated synthetic FAQ entries.
- Normalizes case and punctuation.
- Resolves exact or approved phrase variations.
- Returns a deterministic safe fallback for unknown questions.
- Contains no network, provider, UI, or calendar dependency.

### Provider adapters

- **Browser voice adapter:** starts and closes a browser voice session.
- **Twilio adapter:** validates callbacks and translates ConversationRelay
  messages.
- Adapters implement the same internal session/turn contract.

### Conversation and evidence store

- Stores call/session ID, turn ID, speaker, text, timestamp, status, and latency.
- Starts with an ephemeral in-memory store for the MVP.
- Production-ready implementations use a managed database with encryption,
  expiry, and least-privilege access.
- Raw audio is not stored unless retention is explicitly approved.

## Production patterns

| Pattern | Why it is used |
|---|---|
| Hexagonal/ports-and-adapters | Keep FAQ logic independent of Twilio, browser voice, and LLM providers |
| State machine | Make call state transitions explicit and prevent invalid transitions |
| Side-effect boundary | Keep booking and future tool actions outside the LLM prompt |
| Adapter | Replace STT/TTS or telephony providers without rewriting the core |
| Idempotency | Ignore repeated provider or caller events safely |
| Circuit breaker | Fail predictably when STT/TTS, LLM, or backend dependencies fail |
| Retry with bounded backoff | Recover from transient failure without duplicate side effects |
| Structured logging | Correlate call, turn, provider, and test evidence |
| Trace propagation | Follow a request across browser/API/provider/core components |
| Secrets manager | Keep provider and model credentials out of source and logs |

## Technology recommendation

| Layer | MVP choice | Production alternative |
|---|---|---|
| UI | React + TypeScript | Hosted static UI with a CDN |
| API | Node.js + Fastify + TypeScript | Containers or serverless behind an API gateway |
| Voice for phone | Twilio ConversationRelay | Provider adapter allows replacement |
| Voice for browser | Browser WebRTC plus the provider SDK | Managed realtime voice provider |
| FAQ engine | Deterministic TypeScript service | Deterministic service plus bounded LLM |
| Tests | Vitest + Playwright | Contract, load, security, chaos, and provider sandbox tests |
| Conversation store | In-memory TTL for local MVP | PostgreSQL/managed datastore with encryption |
| Deployment | Local HTTPS tunnel | Managed container platform with autoscaling |
| Observability | Console/structured JSON logs | Central logs, metrics, traces, alerts |

## API sequence

```text
Make call
  -> Create session
  -> Start browser/provider voice session
  -> Connect STT stream
  -> Caller sends text or speech
  -> FAQ engine resolves response
  -> TTS returns audio
  -> Turn is recorded
  -> Call reaches terminal state
  -> Show conversation reads redacted turns
```

The MVP may use text turns behind the browser UI. Real browser calls must use
the provider's supported WebRTC or media API rather than a fake timer.
