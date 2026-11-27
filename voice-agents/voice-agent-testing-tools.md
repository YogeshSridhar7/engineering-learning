# Voice agent testing and automation tools

## What to test

A voice agent is a pipeline, not one model call:

```text
caller audio -> speech recognition -> turn detection -> agent / tools
             -> response text -> speech generation -> caller audio
```

Test each boundary independently, then add progressively more realistic
end-to-end checks. OpenAI recommends moving from generated speech, to replayed
human recordings, to simulated callers, and evaluating task outcomes separately
from latency, interruptions, speech quality, and session reliability
([voice-agent evaluation guidance](https://developers.openai.com/api/docs/guides/voice-agents)).

There is no single industry-wide tool that covers all these layers. Choose
tools that fit the actual voice stack; a platform's simulator is most useful
when the agent itself runs on that platform.

## Tool landscape

| Layer | Tools and what they are useful for |
|---|---|
| Deterministic UI and API tests | **Playwright** for browser flows, permissions, and network assertions; **Vitest/Jest** for unit and contract tests. These are a good fit for pull-request checks. [Playwright browser launch](https://playwright.dev/docs/api/class-browsertype), [Playwright permissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions) |
| Fake microphone / browser media smoke | **Playwright + Chromium fake media devices** can feed a WAV fixture to browser capture. This checks media wiring and the browser integration, not reliable cross-browser speech recognition. [Chromium media switches](https://chromium.googlesource.com/chromium/src/+/main/media/base/media_switches.cc) |
| Speech recognition evaluation | A labeled audio set (audio plus expected transcript) run through the same **STT provider or adapter used in production**. Compare transcripts with a task-appropriate metric and include noisy, accented, short, and silence cases. Browser Web Speech recognition is implementation-dependent and should not be treated as a reproducible ASR benchmark. [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [W3C Web Speech API](https://webaudio.github.io/web-speech-api/) |
| Scripted agent-turn tests | **LiveKit Agents unit tests** support deterministic scripted turns and assertions. **Vapi Evals** support checks such as expected response content and tool calls. These isolate agent behavior but do not by themselves prove real audio capture or recognition quality. [LiveKit unit tests](https://docs.livekit.io/testing/unit-tests/), [Vapi Evals](https://docs.vapi.ai/observability/evals-quickstart.md), [Vapi testing overview](https://docs.vapi.ai/test/voice-testing.md) |
| Whole-conversation simulation | **LiveKit simulations**, **Vapi simulations**, and **Retell simulations / Conductor** can exercise multi-turn scenarios against agents on their platforms and grade outcomes. LiveKit distinguishes text simulations (agent logic/tools) from audio simulations (voice pipeline); use text for fast CI and audio for a smaller scheduled or release suite. [LiveKit simulations](https://docs.livekit.io/testing/simulations/), [LiveKit CI guidance](https://docs.livekit.io/testing/simulations/ci.md), [Vapi simulations](https://docs.vapi.ai/observability/simulations-overview.md), [Retell testing](https://docs.retellai.com/test/test-overview.md), [Retell Conductor](https://docs.retellai.com/test/testing-with-conductor.md) |
| Phone / carrier integration | **Twilio ConversationRelay** connects telephone audio to an application using speech recognition and speech generation; test it against a controlled staging number for routing, transfers, DTMF, and carrier behavior. **Twilio Voice Insights** helps investigate call quality and is operational monitoring, not a substitute for regression assertions. [ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay), [Voice Insights](https://www.twilio.com/docs/voice/voice-insights) |
| Evaluation and observability | Use exact assertions for tool arguments, side effects, and final state. Use an LLM judge only for semantic qualities that cannot be checked exactly, and review failed traces/transcripts and sampled recordings. Track latency and interruption behavior separately from answer correctness. [OpenAI voice-agent evaluation guidance](https://developers.openai.com/api/docs/guides/voice-agents), [Vapi testing overview](https://docs.vapi.ai/test/voice-testing.md) |

These are representative first-party tools and docs, not a market-share ranking.
Provider offerings change; compare current availability, pricing, data
retention, and supported deployment model before committing.

## A practical test ladder

1. **Every change — deterministic tests.** Assert transcript-to-turn handling,
   expected response, citations, tool choice/arguments, errors, and resulting
   application state. Keep them fast and independent of a live speech vendor.
2. **STT changes — labeled audio regression.** Submit a small versioned set of
   recordings to the production STT adapter and compare recognized text or
   intent/entities with expected results. Include explicit silence and
   recognition-failure cases.
3. **Browser integration — prerecorded audio smoke.** Run Chromium with a WAV
   fixture as a fake microphone and grant microphone permission. Verify that
   captured speech produces a turn and visible response. Do not interpret one
   browser run as a reliable measure of general ASR accuracy.
4. **Agent behavior — scenario simulations.** Define goals, expected tool
   outcomes, and failure cases. Run text simulations frequently; run audio
   simulations nightly or before release where provider cost and runtime allow.
5. **Telephony — staging call.** Exercise a controlled phone number for
   carrier-specific audio, routing, DTMF, transfer, interruption, and
   hang-up behavior. Keep this separate from PR checks.
6. **Production — monitored samples.** Correlate turn outcomes, errors, latency,
   and call-quality signals; apply approved recording/transcript retention and
   access policies.

## How to integrate with this repository

The demo already has React + TypeScript, Fastify, Vitest, and Playwright. Its
Playwright test injects a fake browser recognition result, then calls the real
session API and checks the answer, evidence, and synthesized text. It does
**not** test microphone audio or recognition accuracy
([current E2E test](../voice-agent-demo/e2e/learning-session.spec.ts),
[audio testing guide](./voice-agent-audio-testing.md)).

Recommended incremental approach:

1. **Keep the existing test as the fast conversation test.** Its injected
   transcript makes the UI/API/answer path repeatable. Keep assertions on the
   POSTed question, API result, transcript evidence, and spoken answer text.
2. **Add a separate Chromium WAV smoke test.** Use Playwright's browser launch
   arguments for Chromium fake audio capture and grant the `microphone`
   permission to the local app origin. Use a short, clean WAV fixture and
   assert that the expected question reaches the existing session endpoint and
   a valid answer appears. Keep this test distinct and label it as a
   browser/media smoke test. See [Playwright launch arguments](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-args),
   [context permissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions),
   and [Chromium fake audio switches](https://chromium.googlesource.com/chromium/src/+/main/media/base/media_switches.cc).
3. **For repeatable STT quality checks, add an audio-file adapter.** The current
   [`SpeechInputAdapter`](../voice-agent-demo/src/speech-adapters.ts) consumes
   browser recognition events; introduce a replaceable boundary that accepts
   audio and returns a transcript if you want to test a specific production
   recognizer with fixture audio. Test known audio/transcript pairs directly
   against that adapter. Keep vendor credentials out of browser tests.
4. **Keep answer correctness independent of speech recognition.** Test the
   Fastify session endpoint with known text and deterministic answer/retrieval
   dependencies. Add exact assertions for tool actions or state changes if
   those are introduced; semantic graders should complement, not replace,
   deterministic checks.
5. **Only add platform simulations or phone testing when the demo has that
   runtime.** If the application adopts LiveKit, Vapi, or Retell, use that
   platform's simulation interface for multi-turn/audio scenarios. If phone
   calls are added, use a staging number and a separate telephony test gate.

The demo currently uses browser Web Speech APIs and does not place calls
([project README](../voice-agent-demo/README.md)). A browser fake-audio test can
still be useful as an integration smoke test, but browser recognition can rely
on vendor services and is not guaranteed to behave deterministically in
headless CI ([existing caveat and setup](./voice-agent-audio-testing.md)).

### CI split

- **Pull request:** unit/contract tests and existing deterministic Playwright
  journey.
- **Nightly or pre-release:** short WAV browser smoke and a limited STT fixture
  regression suite.
- **Staging/release:** platform audio simulation and controlled phone call if
  those integrations exist.

Do not make every CI run depend on a commercial speech service unless its
availability, cost, credentials, and data handling are acceptable for the
project. OpenAI's current voice-agent evaluation guidance is useful as a
methodology reference; check platform lifecycle notices before adopting any
specific hosted evaluation product ([OpenAI Evals documentation](https://developers.openai.com/api/docs/guides/evals)).
