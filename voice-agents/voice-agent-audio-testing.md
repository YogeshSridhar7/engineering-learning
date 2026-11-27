# Testing voice agents with real audio fixtures

## What the current browser test proves

The current Playwright voice journey supplies a fixed recognized transcript to
the app's speech-recognition adapter. It then exercises the real learning
session API and checks the answer and transcript. It does **not** test WAV
capture, recognition accuracy, or a physical microphone.

## Recommended test layers

1. **Fast UI/API journey:** Keep the existing injected-transcript test. It is
   deterministic and isolates session behavior, grounded answers, citations,
   failures, and transcript display.
2. **Browser audio smoke test:** Add a separate Chromium-only Playwright test
   with a short, controlled WAV fixture as fake microphone input. Grant
   microphone permission to the app origin. Assert the recognized question is
   submitted and the returned answer/evidence appears in the conversation.
3. **Recognition evaluation:** Run the same fixtures through the production
   speech-recognition service or a supported local ASR engine and compare
   recognized text with expected transcripts. Keep this separate from the
   browser-agent journey so recognition-quality failures are distinguishable
   from session/API/grounding failures.
4. **Manual device check:** Retain a manual test for actual microphones,
   permissions, acoustic conditions, and browser support.

## Chromium fake microphone setup

Playwright supports Chromium launch arguments and browser-context permissions.
Chromium provides a fake media device and a switch to use a WAV file for fake
audio capture. The WAV switch accepts `%noloop` to stop at the end of the
fixture. Use these only in a dedicated audio-test configuration; they are
Chromium-specific and do not simulate actual hardware.

```ts
const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${absoluteWavPath}%noloop`,
  ],
})
const context = await browser.newContext()
await context.grantPermissions(['microphone'], { origin: appOrigin })
```

In this app, the audio smoke test should start the existing API and UI, open a
session, click **Ask by voice**, wait for the real `POST /api/sessions/:id/turns`,
and inspect the saved transcript through the UI. Do not stub that endpoint in
the audio smoke test. Keep test timeouts bounded because browser recognition
may take longer than the deterministic fixture-based test.

## Important recognition caveat

The app currently uses the browser Web Speech API. Browser support is limited
and implementation-dependent; recognition may use a browser-vendor service,
may need network access, and is not guaranteed to process identically in
headless CI. Therefore a Chromium WAV test is an integration smoke test, not
proof that recognition will be deterministic across browsers or CI machines.
If repeatable recognition-quality tests are required, add a replaceable
audio-file STT adapter for a controlled local or hosted recognizer and test it
with known WAV/transcript pairs. Keep provider credentials and audio retention
policy out of the browser test.

## What to assert

- The audio fixture produces the expected question, or the expected intent /
  key entities if exact recognition is not stable.
- The question reaches the existing learning-session endpoint.
- A known-answer fixture yields a non-fallback answer with expected evidence.
- The transcript view contains the question, returned answer, and source
  excerpt; a no-evidence fixture produces the explicit fallback without fake
  citations.
- Permission denial, no speech, recognition failure, and answer-provider
  failure remain visible and do not create an invented answer.

Do not treat a transcript-injection test as an audio test. Do not make every
CI run depend on a commercial recognition service unless its availability,
cost, privacy, and credentials are explicitly acceptable.

## Primary sources

- Playwright browser launch options: <https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-args>
- Playwright context permissions: <https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions>
- Chromium media switches, including fake audio capture: <https://chromium.googlesource.com/chromium/src/+/main/media/base/media_switches.cc>
- Chromium fake audio input implementation: <https://chromium.googlesource.com/chromium/src/+/main/media/audio/fake_audio_input_stream.h>
- MDN SpeechRecognition support and behavior: <https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition>
- MDN Web Speech API usage: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API>
- W3C Web Speech API specification: <https://webaudio.github.io/web-speech-api/>
- OpenAI voice agent architectures and evaluation: <https://developers.openai.com/api/docs/guides/voice-agents>
- LiveKit unit testing and simulations: <https://docs.livekit.io/testing/unit-tests.md> and <https://docs.livekit.io/testing/simulations.md>
