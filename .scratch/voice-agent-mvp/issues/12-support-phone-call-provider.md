# 12: Add optional support-phone calling

**What to build:** After the browser learning agent is complete, an optional
support or learning phone number asks the same grounded learning questions and
uses the same conversation and evidence service.

**Blocked by:**
- 08: Add browser voice input and output.
- 09: Add transcript and source evidence display.
- 11: Add privacy and cleanup controls.

**Status:** ready-for-agent

- [ ] A personal provider account and test number are isolated from employer
      credentials.
- [ ] Provider callbacks validate signatures and bind call/session IDs.
- [ ] The support call uses the same text retrieval and answer service.
- [ ] Twilio/provider types stay outside the learning core.
- [ ] Default automated tests never place live calls.
- [ ] At least one manual support call answers a known leadership or QA question
      with a source.
- [ ] A no-evidence support call uses the safe fallback.
- [ ] Call and transcript retention follow the privacy controls.
