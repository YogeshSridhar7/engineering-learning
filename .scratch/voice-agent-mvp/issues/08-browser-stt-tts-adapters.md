# 08: Add browser voice input and output

**What to build:** A learner can speak a question, hear a grounded answer,
and continue within the browser session.

**Blocked by:** 07: Connect browser learning UI to the API.

**Status:** implemented (manual microphone check pending)

- [x] Microphone permission, listening, thinking, speaking, and ended states
      are explicit.
- [x] STT and TTS implementations are replaceable adapters.
- [x] STT text enters the same learning-session API used by typed questions.
- [x] TTS receives short, speakable grounded text and never reads raw URLs.
- [x] STT/provider failures do not expose secrets or invent answers.
- [x] STT fixture tests cover silence, noise, accents, interruption, and
      malformed results.
- [ ] A manual browser-microphone check exercises one known-answer question.
