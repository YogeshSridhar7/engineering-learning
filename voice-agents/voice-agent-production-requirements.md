# Voice Agent Production Requirements

## Status

This document defines the gap between the local voice-agent MVP and a
production-grade system. It is an architectural baseline, not implementation
code.

## Reliability and availability

- Define liveness, readiness, and dependency health endpoints.
- Make call/session creation idempotent.
- Process duplicate provider events once.
- Set bounded retries, retry backoff, and circuit-breaker thresholds.
- Define fallback behavior for STT, TTS, model, storage, and provider failure.
- Preserve conversation state in durable storage in production.
- Establish recovery objectives and deploy with rolling or blue-green releases.
- Test graceful shutdown so active calls are handled or clearly ended.

## Security

- Do not expose public endpoints without authentication, authorization, or
  short-lived signed sessions.
- Validate every voice-provider callback signature and bind it to the expected
  account, call ID, and session ID.
- Reject stale/replayed callbacks and mismatched call identities.
- Encrypt secrets at rest and in transit; use a managed secrets store.
- Run credentials with least privilege and define rotation procedures.
- Validate all input and provider payload size/type.
- Apply rate limits at IP, session, and account levels.
- Set security headers and use strict CORS.
- Treat caller text and STT output as untrusted model input.
- Keep tools and privileged actions outside the LLM for the MVP.
- Prevent prompt injection from changing system instructions or response policy.
- Store and serve conversations only to authorized sessions/users.

## Privacy and compliance

- Explain recording/transcription use before call processing when applicable.
- Minimize collected fields and do not store real health or personal information
  in the demo.
- Define explicit audio, transcript, and log retention periods.
- Implement deletion and cleanup for expired sessions.
- Redact secrets and sensitive fields before logs/evidence are written.
- Review provider model storage and data-processing terms before production use.
- Apply regional, consent, accessibility, and telephony requirements for the
  target customers.

## Performance and scalability

- Separate stateless API processing from real-time voice transport.
- Use horizontal scaling and connection-appropriate infrastructure.
- Set latency budgets for:
  - speech to final transcript;
  - intent/FAQ resolution;
  - model time to first token, if used;
  - text to first audio;
  - complete turn and call setup.
- Track P50, P95, P99, and error-rate metrics for each stage.
- Load test concurrent calls and WebSocket connections.
- Bound model tokens, timeout, queue depth, and concurrency.
- Define provider and server cost limits.
- Measure audio quality and interruption/barge-in behavior.

## Conversation correctness

- Version FAQ content and model/system prompts.
- Add a deterministic intent/routing boundary before an LLM.
- Validate every FAQ response and structured model output.
- Do not generate unsupported facts for unknown questions.
- Preserve a safe fallback and escalation state.
- Never claim a booking or side effect unless the backend confirms it.
- Require explicit confirmation for every future action with side effects.
- Implement idempotency for repeated turn/tool requests.

## Testing

### Fast suite

- FAQ exact-match and phrase-variation tests.
- Unknown, empty, greeting, and long-input tests.
- Session isolation and duplicate-turn tests.
- API validation and authorization tests.
- State-transition tests.
- Provider-payload contract fixtures.

### Integration suite

- Browser voice and phone provider sandbox flows.
- Webhook signature, replay, malformed payload, and mismatch tests.
- STT/TTS failure and timeout tests.
- Provider outage fallback tests.
- Conversation persistence and expiry tests.
- Playwright UI tests for call status and transcript display.

### End-to-end checks

- Human-spoken browser call.
- Human-spoken phone call.
- Transcript accuracy and end-to-end turn latency.
- Interruptions, silence, accents, noise, and barge-in.
- Exactly one completed call and conversation for repeated actions.

### Security and resilience

- Prompt-injection cases.
- Unauthorized session read/write.
- Rate-limit and concurrency abuse.
- Secret/log/screenshot leakage.
- Dependency failure and timeout injection.
- Malicious payload, oversized input, and invalid encoding.

## Observability

Required fields:

- call/session ID;
- turn ID;
- provider call ID;
- trace/correlation ID;
- state transition;
- input/output token count when applicable;
- STT/TTS and model latency;
- provider error code;
- fallback result;
- transcript retention state.

Avoid logging raw audio, secrets, auth headers, or unnecessary personal data.

## Accessibility and UX

- The UI should support keyboard navigation and visible focus.
- Status changes must be announced to screen-reader users.
- Call controls should have clear labels and terminal states.
- Transcript content should not rely on color alone.
- The UI should expose clear errors and retry paths.
- The UI should disclose that it is a synthetic/demo agent.

## Deployment

- Pin runtime and dependencies; scan vulnerabilities during CI.
- Generate an SBOM and signed artifacts for production releases.
- Scan containers/dependencies and require patching policies.
- Deploy through CI/CD with environment separation.
- Apply infrastructure-as-code and reviewed change control.
- Define rollback, incident, and provider-abuse runbooks.

## Acceptance criteria for production sign-off

The system is not production-grade until all of these are demonstrated:

- Authentication/authorization and callback validation pass security tests.
- Privacy and retention policies are implemented and tested.
- Every call and turn is traceable without exposing secrets or unnecessary
  personal data.
- P95/P99 latency and capacity targets are met under load.
- Provider and dependency failures produce bounded, safe behavior.
- Automated tests cover core, API, browser, provider contracts, security, and
  resilience.
- Manual end-to-end testing includes real speech, noise, interruption, and
  terminal failure behavior.
- Runbooks and on-call ownership exist.
