# Voice Learning Agent MVP

## Status

Learning project; no authentication; no employer systems; no real customer or
healthcare data; approved learning sources only.

## Problem Statement

A learner wants to study a topic without repeatedly typing questions or losing
conversational context. They also want answers grounded in material they have
chosen rather than unsupported information from a general-purpose model.

The project will initially focus on improving the owner's leadership
communication style, and later support additional learning topics such as QA
engineering and software architecture.

## Solution

Build a browser and phone voice assistant that:

1. Speaks the learner's selected topic or subject.
2. Converts spoken questions to text.
3. Retrieves relevant passages from an approved knowledge source.
4. Generates a concise, grounded answer.
5. Speaks the answer.
6. Shows the transcript and supporting sources.
7. Supports follow-up questions in the same learning session.

The MVP is a grounded voice-RAG tutor, not a general-purpose chatbot. The
system should answer only from indexed learning material or clearly state that
the source set does not contain an answer.

## Scope for MVP

- Voice input through the browser.
- Optional voice output through the browser.
- One selected learning mode: leadership communication or QA engineering.
- Ingestion of approved public documents, articles, and original notes.
- Text extraction, chunking, embeddings, retrieval, and grounded answers.
- Source title, URL or document reference, and excerpt for every answer.
- Safe fallback when no relevant source is found.
- Short multi-turn conversation context.
- A professional browser interface with:
  - **Start learning session**
  - **Ask a question** through voice
  - **Show conversation**
- Completed or active sessions display transcript turns and cited sources.
- Automated text-level tests for retrieval and answer behavior.
- Vitest tests for ingestion and conversation behavior.
- Playwright tests for browser session and transcript behavior.
- A manual browser-voice end-to-end check.

## Out of Scope

- Appointment booking.
- Google Calendar integration.
- Authentication and MFA in the first MVP.
- CRM, payment, identity, or medical systems.
- Production coaching or therapeutic advice.
- Full copyrighted books or long copyrighted articles.
- Scraping paywalled, private, or unlicensed material.
- Automated real phone calls in the default test suite.
- Recording or retaining audio/transcripts unless explicitly authorized.
- Twilio or other provider integrations before the text and browser RAG flow
  works.

## User Stories

1. As a learner, I want to speak a question, so that I can study hands-free.
2. As a learner, I want answers from selected learning material, so that I can
   trust the source of the explanation.
3. As a leadership learner, I want to ask how to improve clear communication,
   so that I can practice a specific leadership behavior.
4. As a learner, I want to ask for an example, so that an explanation becomes
   easier to apply.
5. As a learner, I want to ask a follow-up, so that I can continue one topic
   without repeating context.
6. As a learner, I want to see source excerpts, so that I can verify a claim.
7. As a learner, I want the agent to say when it lacks evidence, so that it
   does not invent an answer.
8. As a learner, I want to see the conversation transcript, so that I can review
   what was discussed.
9. As a learner, I want citations in a visible and spoken answer, so that I can
   distinguish the source from the synthesis.
10. As a developer, I want ingestion and retrieval testable without live voice,
    so that evaluation is repeatable.
11. As a QA engineer, I want known-answer test cases, so that grounded-answer
    quality can be measured.
12. As a QA engineer, I want retrieval metrics, so that failures can be traced
    to indexing or ranking.
13. As a QA engineer, I want malformed audio/text and out-of-domain questions
    covered, so that fallback behavior is reliable.
14. As a developer, I want provider adapters, so that STT, embedding, LLM, and
    TTS implementations can change without rewriting the core.
15. As a privacy-conscious learner, I want audio and transcripts controlled,
    so that personal material is not silently retained.

## Architecture Decisions

The primary test seam is a text and retrieval pipeline:

```text
Approved sources
  -> ingestion
  -> text extraction
  -> chunking
  -> embeddings
  -> vector index

Spoken or typed question
  -> STT adapter (when spoken)
  -> session turn
  -> query embedding
  -> similarity retrieval
  -> reranking (if available)
  -> grounded answer generation
  -> TTS adapter (when spoken)
  -> visible answer + citations + transcript
```

The browser is one transport. The same backend question-and-answer service
must serve typed questions, browser voice, and later telephone voice.

Use a hexagonal/ports-and-adapters structure:

- A conversation service owns session turns and response policy.
- A retrieval service owns approved-source search.
- An answer service constructs grounded responses from retrieved chunks.
- STT, embedding, LLM, TTS, vector-store, and provider implementations sit
  behind replaceable adapters.
- A deterministic response policy controls unknown and insufficient-evidence
  cases before model generation.

## Knowledge and Licensing Decisions

- Include only public, licensed, or owned learning material.
- Record source title, author, URL, license or usage basis, retrieval date,
  and local chunk ID.
- Prefer summaries and short excerpts rather than full-copy ingestion.
- Do not ingest employer confidential material or personal health information.
- Strip or reject tracking parameters and secrets from URLs.
- Test that a source can be removed and purged from the local index.

## Grounding and Response Decisions

- Retrieval is required; the model must not answer from general knowledge for
  source-dependent questions.
- Every answer includes at least one source reference or an explicit fallback.
- The answer response separates the spoken text, citations, and confidence.
- Retrieved chunks are the only evidence for the answer.
- The model may synthesize a concise explanation only from those chunks.
- Unknown questions produce:
  "I could not find enough evidence in the selected learning material."
- The system should distinguish "not found" from "multiple answers disagree."
- Leadership practice prompts may request examples or follow-up questions, but
  they must remain grounded in the selected sources.
- The default response is speakable: short paragraphs, few abbreviations, and
  no raw source-link URLs.

## Environment and Tooling Decisions

- Node.js LTS and npm.
- React and TypeScript for the browser interface.
- Fastify and TypeScript for the backend.
- Vitest for unit and service tests.
- Playwright for browser UI tests.
- A managed or local vector store appropriate to the local learning dataset.
- Managed STT/TTS and an LLM API behind provider adapters.
- PostgreSQL or a managed JSON document store only if session persistence is
  required later.
- Docker and Nginx for the local deployment demonstration.
- Environment variables for model, vector-store, and provider credentials.

## Testing Decisions

Tests verify external behavior rather than vector-store implementation
details. A test asks a question and asserts the retrieved source, grounded
response, fallback, and transcript behavior.

Required test categories:

- Source ingestion and metadata preservation.
- Chunk deduplication and source removal.
- Known-answer retrieval.
- Paraphrased questions and spelling variations.
- Out-of-corpus questions.
- Conflicting sources.
- Empty, noisy, and long text inputs.
- Short follow-up questions that require conversation context.
- Citation accuracy.
- Unsupported claim/hallucination detection.
- STT transcript text fixtures.
- TTS input suitability.
- Provider timeout and rate-limit failure.
- Browser session start, stop, transcript, and source display.
- Conversation/session isolation.

Good tests use independent, worked expected answers and source identifiers.
They do not assert that generated wording is exactly equal to a stored string.
Assess semantic grounding against the cited passages and source IDs.

## MVP Ticket Sequence

### 1. Foundation and UI

- Keep the existing React, Fastify, Docker, Nginx, and health foundation.
- Add a learning-session shell, **Start learning session**, and
  **Show conversation** controls.
- Do not call a real voice provider until later tickets pass.

### 2. Knowledge source ingestion

- Select an initial approved source set.
- Record source metadata and license/usage basis.
- Extract text, split it into bounded chunks, and preserve source identifiers.
- Add tests for metadata, chunk boundaries, duplicate removal, and source purge.

### 3. Retrieval core

- Index generated embeddings in a local vector store.
- Implement semantic retrieval and source filtering.
- Add known-answer, paraphrase, out-of-domain, and conflicting-source tests.
- Surface retrieved source IDs and excerpt text.

### 4. Grounded answer service

- Send only retrieved evidence and approved system instructions to the model.
- Add the source and citation response contract.
- Reject unsupported claims and unknown evidence.
- Test hallucination-resistant behavior with synthetic and real local sources.

### 5. Text conversation service

- Add isolated sessions and recent-turn context.
- Support typed questions, follow-up questions, and session reset.
- Keep provider and TTS code outside the answer service.

### 6. Browser voice integration

- Add browser microphone permission and provider-backed STT/TTS.
- Add session start, listening, thinking, speaking, and ended states.
- Show live and completed transcripts.
- Add Playwright UI coverage and a manual browser-voice check.

### 7. Automated evidence

- Record retrieval hits, source IDs, answer quality, and latency.
- Separate unit, retrieval, provider integration, browser, and manual evidence.
- Produce a single local run command and a redacted demo report.

### 8. Optional phone provider

- Add only after the browser and text pipeline are complete.
- Use Twilio or another approved provider behind the adapter.
- Default test suite must not place live calls.

## Acceptance Criteria

The MVP is complete when:

- A learner can ask a leadership or QA question by voice in the browser.
- The answer is generated from selected learning material.
- At least one accurate source is shown for every evidence-based answer.
- Out-of-corpus questions produce the approved fallback.
- The transcript and sources are visible after the session.
- Follow-up questions retain only session-approved context.
- Source purge removes its chunks and future answers.
- Unit and retrieval tests run without a voice call or secret.
- Browser tests prove session and transcript behavior.
- A manual browser-voice check demonstrates the complete flow.
- No provider credential, private source, full copyrighted text, or secret is
  committed.

## Implementation Priority

1. Foundation UI and source ingestion.
2. Retrieval and grounded-answer tests.
3. Text chat and follow-up sessions.
4. Browser STT/TTS.
5. Evidence and conversation transcript.
6. Optional phone integration.

## Further Notes

This project is particularly useful for leadership communication practice
because it can use concise, licensed materials on listening, feedback,
delegation, conflict, clarity, and status updates. It can ask follow-up
questions, role-play a scenario, and provide a source-backed explanation.

It is also a strong QA/AI-engineering portfolio project because quality can be
measured across retrieval, grounding, voice transcription, context, latency,
and fallback behavior.
