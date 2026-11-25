# Voice Appointment Agent Demo — Project Context

## Purpose

Build a small, independent voice-agent demo to learn and demonstrate QA
automation skills. The demo is not connected to an employer system and is not
for real healthcare use.

The initial caller asks for a fictional health-check appointment. The agent
checks availability, confirms the exact date and time, and creates an event
only after explicit caller confirmation.

## Goals

- Learn the main components of a phone-based AI voice agent.
- Keep appointment rules independently testable without making phone calls.
- Add an optional phone interface after the core flow is reliable.
- Automate repeatable tests and capture useful, non-sensitive evidence.
- Build a portfolio project that contains only original demo code and synthetic
  data.

## Non-goals

- Connecting to the employer's agent, APIs, Google account, phone numbers, or
  source code.
- Handling real patients, personal health information, or real appointments.
- Presenting the demo as a production-ready medical or scheduling system.
- Bypassing authentication, MFA, provider restrictions, or consent requirements.

## Suggested architecture

```text
Test caller / phone
        |
Twilio Programmable Voice + ConversationRelay
        |  recognized caller text / agent text for speech
Node.js + TypeScript application
        |
Conversation and booking rules
        |                         |
LLM provider adapter (optional)   Calendar adapter
                                  |-- fake in-memory calendar (first)
                                  |-- dedicated Google test calendar (later)
```

ConversationRelay is the first suggested phone integration because Twilio
handles speech recognition and speech output. The application still owns
conversation policy, validation, and booking logic. A browser calling interface
is a separate enhancement; Playwright alone does not provide a simulated voice
caller.

## Suggested technology choices

- Node.js LTS and TypeScript.
- Twilio Programmable Voice and ConversationRelay for the initial phone route.
- A small HTTP/WebSocket server (for example, Fastify plus a WebSocket library)
  to receive provider events and manage the call.
- A deterministic conversation implementation first; add an LLM provider only
  after the booking rules and tool boundaries are covered by tests.
- A calendar interface with a fake implementation first, then Google Calendar
  API with a dedicated personal test account and least-privilege OAuth access.
- Vitest for unit and service tests.
- Playwright for any browser UI and browser-level flows, not for injecting
  audio into a telephone call.
- A secure HTTPS tunnel for local provider callbacks during development, if
  required. Do not expose a server without understanding the tunnel and
  provider security configuration.

## Core behavior and safety rules

1. Ask for the requested appointment date and time, including timezone where
   needed.
2. Resolve ambiguous or invalid dates by asking a clarifying question.
3. Check availability before offering or booking a slot.
4. Read back the selected date, time, and appointment type.
5. Require explicit caller confirmation before creating an event.
6. Validate all tool arguments server-side; never trust model-produced
   arguments without validation.
7. Create at most one event for one confirmed booking request. Use an
   idempotency key or equivalent duplicate protection.
8. If calendar creation fails, do not claim the appointment was booked.
9. Keep the demo limited to fictional appointment data. Do not collect or store
   medical details.
10. Do not record or retain call audio/transcripts unless consent, retention,
    and applicable legal requirements have been addressed.

## Build phases

### Phase 1 — Domain rules without voice or external services

- Define appointment, availability, confirmation, and booking result types.
- Implement a fake calendar adapter.
- Implement booking rules as ordinary application code.
- Add tests for available slot, unavailable slot, ambiguous time, declined
  confirmation, calendar failure, and duplicate request.

**Exit check:** Tests prove that no event is created without confirmation and
that a repeated confirmed request does not create duplicates.

### Phase 2 — Conversation flow without a phone call

- Implement a deterministic scripted conversation state machine.
- Feed it text turns from tests.
- Verify clarification, read-back, confirmation, and failure responses.
- Add an LLM adapter only after deterministic behavior is testable; keep the
  booking service responsible for validation and side effects.

**Exit check:** Conversation tests prove the correct state transitions and
tool-call arguments from synthetic text inputs.

### Phase 3 — Twilio phone proof of concept

- Create a personal Twilio project and review current account, number,
  geographic availability, trial, and pricing terms.
- Configure a test number/route and ConversationRelay according to current
  Twilio documentation.
- Run the server locally and expose only the required HTTPS/WebSocket endpoints
  using an approved development tunnel.
- Validate provider webhook signatures and secure WebSocket connections.
- Make a manual call using synthetic data and the fake calendar.

**Exit check:** A manual call completes the demo flow without any real calendar
write.

### Phase 4 — Calendar integration

- Create a dedicated personal Google test account/calendar.
- Enable Google Calendar API and configure OAuth using Google's current
  guidance.
- Implement the calendar adapter and request only the required access.
- Test event creation, read-back, timezone behavior, API errors, and cleanup.
- Keep tokens and provider secrets in environment variables or a local ignored
  secrets file; never commit them.

**Exit check:** An explicitly confirmed synthetic booking creates exactly one
event in the dedicated test calendar and can be verified and removed.

### Phase 5 — Repeatable voice testing

- Keep fast deterministic tests as the main regression suite.
- Add provider/call integration tests only where supported and affordable.
- For repeatable speech, use a provider-supported test caller/SIP path or a
  deliberately configured audio-injection setup. Validate this against the
  chosen transport; it is not supplied by Playwright.
- Retain a small number of human-spoken end-to-end checks for real audio and
  telephony behavior.
- Capture call/session IDs, transcript where permitted, timings, tool
  invocation, and calendar result. Redact personal data.

## Initial scenario

**Book an available fictional health-check appointment**

Given the fake calendar has no event at the chosen synthetic slot,
when the caller requests a health check at that slot,
and the agent confirms the date, time, and timezone,
and the caller explicitly agrees,
then exactly one event is created and the agent reports success.

### Important variations

- Requested slot is unavailable: offer alternatives; do not book until one is
  selected and confirmed.
- Caller corrects the date/time: use the corrected value in the final
  confirmation and event.
- Caller declines: no event is created.
- Caller disconnects before confirmation: no event is created.
- Calendar API fails or times out: do not claim success.
- Same request is repeated: do not create a duplicate event.
- Date, time, or timezone is ambiguous: clarify before booking.

## Test strategy

- **Unit tests:** date/time parsing, confirmation policy, idempotency, and
  booking decisions. No Twilio, LLM, or Google API calls.
- **Conversation tests:** synthetic text turns against deterministic logic;
  assert agent responses and requested tool actions.
- **Adapter tests:** verify Google Calendar mapping with a fake server or
  isolated test account, depending on the risk and available setup.
- **Twilio integration:** a few manual or provider-supported sandbox calls;
  avoid placing calls in every unit-test run.
- **Browser tests:** Playwright only for a browser UI if one is added. Do not
  treat UI codegen as a voice-call simulator.
- **Evidence:** test name, synthetic inputs, expected/actual result, call ID
  when applicable, duration, tool action, and calendar read-back. Keep artifacts
  local or in an approved portfolio location, and redact identifiers.

## Secrets and local configuration

Use environment variables for local development. Example variable names:

```text
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
LLM_API_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
```

These are names only, not real values. Add `.env` and token files to
`.gitignore`; commit only a `.env.example` with empty placeholders. Never paste
secrets into chat, screenshots, source code, or a public repository. Rotate any
secret that is accidentally exposed.

## Learning and implementation references

- [Twilio ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [Twilio trial account overview](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account)
- [Google Calendar API Node.js quickstart](https://developers.google.com/workspace/calendar/api/quickstart/nodejs)

Before using a provider, confirm current service availability, trial limits,
pricing, and regional requirements directly in its official documentation.

## Done means

- Core booking rules are covered by automated tests using a fake calendar.
- No booking occurs before clear confirmation.
- Duplicate requests and dependency failures are handled safely.
- Phone integration is isolated behind adapters and tested separately.
- All configuration is externalized; no secrets or real personal data are in
  the repository.
- The demo and its limitations are clearly labeled as educational and
  non-production.
