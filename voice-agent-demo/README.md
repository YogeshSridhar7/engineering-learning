# Voice agent demo foundation

This project contains the React demo UI, TypeScript Fastify API, health
endpoint, tests, and container configuration. It does not place calls,
authenticate users, persist conversations across server restarts, or create
appointments.

## Prerequisites

- Node.js 24 LTS
- npm
- Docker with the Docker daemon running (for the containerized deployment)
- Playwright Chromium (for browser tests; install with `npx playwright install chromium`)
- Ollama with `llama3.2:latest` and `all-minilm` for local model-backed answers
  and semantic retrieval

## Local development

```sh
npm install
npm run dev:server
```

In a separate terminal:

```sh
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is
`http://localhost:3001/api/health`.

## Validation

```sh
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

The automated voice-to-transcript journey can also be run by itself:

```sh
npm run test:e2e -- --grep "spoken question"
```

That Playwright test simulates the browser speech-recognition result, then
exercises the real session API and verifies the returned answer and citation
in the conversation transcript. It does not record physical microphone audio
or validate the browser's speech-recognition accuracy; those require a manual
microphone check in a supported browser. For the recommended prerecorded-WAV
Chromium test layer and its Web Speech API limitations, see
[the voice-agent audio testing guide](../voice-agents/voice-agent-audio-testing.md).

Start the built API:

```sh
npm start
```

## Docker

```sh
docker compose up --build
```

Open `http://localhost:8080`. Nginx serves the React build and proxies
`/api/*` to the Fastify API.

```sh
docker compose down
```

## Learning session UI

- Start learning session creates an isolated text session and shows connecting,
  active, and ended states.
- Ask typed questions or use **Ask by voice**. Spoken questions go through the
  same learning-session API; the browser reads the grounded answer aloud.
- The UI shows voice-ready, listening, thinking, speaking, and ended states.
  Use **Stop voice** to interrupt listening or speech; typed questions remain
  available if speech is unsupported or microphone access is denied.
- End session clears server-side conversation context; the page keeps the
  completed transcript available until a new session starts or the page closes.
- The browser uses its built-in Web Speech APIs, not a separate speech vendor
  configured by this app. Recognition availability varies by browser, and a
  browser may process microphone audio using its own speech service. The app
  does not send audio to the learning API or store audio recordings. Use
  localhost or HTTPS and allow microphone access to try voice input.
- Spoken answers use only the answer text, omit raw URLs, and are limited to
  about 500 characters. Source links and excerpts remain visible on screen.
- This demo does not place calls or create appointments.
- Do not add real caller data or employer credentials.
- Copy `.env.example` to `.env` only for local values.

## Leadership learning sources

The foundation includes two free public source references:

- Google re:Work — The Five Keys to a Successful Team.
- Atlassian Team Playbook — Constructive Feedback.

## Knowledge retrieval

Ticket 03 uses local Ollama embeddings and cosine similarity over an
in-memory vector index. It does not require a cloud embedding API or external
vector database. The public API:

```sh
curl -X POST http://localhost:3001/api/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"question":"How does psychological safety help a team?","limit":3}'
```

The response includes rank, source ID, source title, author, URL, score, and
excerpt. Passages from different sources remain separate results. An
out-of-corpus question below the configured similarity threshold returns an
empty result list. The default threshold is `0.25` and can be tuned with
`RETRIEVAL_MINIMUM_SCORE`.

Install Ollama, then check or pull the local models:

```sh
ollama list
ollama pull all-minilm
ollama pull llama3.2:latest
```

The chat model is configurable with `OLLAMA_CHAT_MODEL`; the embedding model
is configurable with `OLLAMA_EMBEDDING_MODEL`. Both integrations sit behind
replaceable provider interfaces, and the vector index behind a replaceable
vector-store interface. To try a newer model, pull it and change the
corresponding variable in `.env`; retrieval and answer code do not need to
change. Ollama must be running locally. If it or a model is unavailable, the
API returns a clear service error—it does not silently switch to lexical-only
or cloud answers.

The vector index is rebuilt from the in-memory approved source collection
after a server restart. Newly added or changed sources are re-embedded on the
next retrieval; removed source chunks are purged from the in-memory index.
The lexical retriever remains available for deterministic tests, but it is not
an automatic production fallback.

The app stores short original summaries and short excerpts, not full articles
or podcast transcripts. Source metadata and excerpts are available through
`GET /api/sources`. To remove a source and its derived chunks:

```sh
curl -X DELETE http://localhost:3001/api/sources/google-project-aristotle
```

## Grounded answers

Answers use `llama3.2:latest` through Ollama by default, so the app makes no
external model requests. The API sends the learner's question and only the
highest-ranked retrieved excerpt (plus bounded, approved recent-session
evidence for a follow-up). Retrieved source text is untrusted input, and the
model has no tools. The provider and model are configurable via
`ANSWER_PROVIDER` and `OLLAMA_CHAT_MODEL`.

The answer API validates that every returned citation belongs to retrieved
evidence and rejects uncited non-empty responses. This does not independently
prove that every generated sentence is entailed by its citation. Review the
provider's data handling/retention terms before configuring an optional
external provider, and do not submit private or confidential learning
material. Provider failures return HTTP 502 instead of silently substituting
a demo answer.

## Text learning sessions

The text session API keeps isolated, in-memory sessions for follow-up questions.
Create a session, then send turns using its opaque ID:

```sh
curl -X POST http://localhost:3001/api/sessions
curl -X POST http://localhost:3001/api/sessions/<session-id>/turns \
  -H 'Content-Type: application/json' \
  -d '{"question":"How does psychological safety help a team?"}'
curl -X POST http://localhost:3001/api/sessions/<session-id>/turns \
  -H 'Content-Type: application/json' \
  -d '{"question":"Why is that important?"}'
curl http://localhost:3001/api/sessions/<session-id>/transcript
curl -X POST http://localhost:3001/api/sessions/<session-id>/reset
```

The transcript endpoint returns the session's saved questions, answers, and
source evidence. Fetch it before resetting the session, which clears its
server-side conversation context.

Follow-ups receive at most three recent turns' questions and their retrieved
evidence; the retrieval query combines those questions with the current one.
Only the highest-ranked evidence from each turn is retained for context. A
session expires after one hour of inactivity, stores at most 20 turns, and the
service accepts at most 500 active sessions. State is lost when the API
restarts. There is no authentication or durable storage; keep this demo local
or on a trusted network.
