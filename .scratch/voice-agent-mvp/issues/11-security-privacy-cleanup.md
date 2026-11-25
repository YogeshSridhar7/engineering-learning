# 11: Add privacy and cleanup controls

**What to build:** Learning sessions and source data have bounded retention,
explicit cleanup, and safe evidence handling.

**Blocked by:** 09: Add transcript and source evidence display.

**Status:** ready-for-agent

- [ ] Sessions and transcripts have local retention and cleanup behavior.
- [ ] Source purge removes source records and derived chunks.
- [ ] Browser evidence and logs redact secrets and unnecessary personal data.
- [ ] Credential, private-key, and `.env` files remain excluded from source
      control.
- [ ] Provider STT/TTS retention is disabled or disclosed where locally
      configurable.
- [ ] Tests verify cleanup, source purge, secret redaction, and isolation.
- [ ] Public demo deployment has a documented authorization/rate-limit decision.

