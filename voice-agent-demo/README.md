# Voice agent demo foundation

This project contains the React demo UI, TypeScript Fastify API, health
endpoint, tests, and container configuration. It does not place calls,
authenticate users, store conversations, or create appointments.

## Prerequisites

- Node.js 24 LTS
- npm
- Docker with the Docker daemon running

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
npm run typecheck
npm run lint
npm run build
```

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

## Scope

- The Make call button reports that no voice provider is configured.
- The Show conversation button remains unavailable until a call exists.
- Do not add real caller data or employer credentials.
- Copy `.env.example` to `.env` only for local values.

## Leadership learning sources

The foundation includes two free public source references:

- Google re:Work — The Five Keys to a Successful Team.
- Atlassian Team Playbook — Constructive Feedback.

## Knowledge retrieval

Ticket 03 uses deterministic lexical retrieval, not embeddings or an external
vector database. The public API:

```sh
curl -X POST http://localhost:3001/api/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"question":"How does psychological safety help a team?","limit":3}'
```

The response includes rank, source ID, source title, author, URL, matched
terms, score, and excerpt. An out-of-corpus question with no sufficiently
strong match returns an empty result list.

The app stores short original summaries and short excerpts, not full articles
or podcast transcripts. Source metadata and excerpts are available through
`GET /api/sources`. To remove a source and its derived chunks:

```sh
curl -X DELETE http://localhost:3001/api/sources/google-project-aristotle
```

## Grounded answers

Answers use a deterministic excerpt response by default, so the app makes no
external model requests. To enable synthesis through an OpenAI-compatible chat
completion API, configure `ANSWER_PROVIDER=openai-compatible`,
`OPENAI_API_KEY`, and `OPENAI_MODEL` in the API environment. The API sends the
learner's question and only the single highest-ranked retrieved excerpt; it
does not send unrelated source-store data or API credentials in the prompt.
Retrieved source text is untrusted input, and the model has no tools.

The answer API validates that every returned citation belongs to retrieved
evidence and rejects uncited non-empty responses. This does not independently
prove that every generated sentence is entailed by its citation. Review the
provider's data handling/retention terms before enabling it, and do not submit
private or confidential learning material. Provider failures return HTTP 502
instead of silently substituting a demo answer.

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
curl -X POST http://localhost:3001/api/sessions/<session-id>/reset
```

Follow-ups receive at most three recent turns' questions and their retrieved
evidence; the retrieval query combines those questions with the current one.
Only the highest-ranked evidence from each turn is retained for context. A
session expires after one hour of inactivity, stores at most 20 turns, and the
service accepts at most 500 active sessions. State is lost when the API
restarts. There is no authentication or durable storage; keep this demo local
or on a trusted network.
