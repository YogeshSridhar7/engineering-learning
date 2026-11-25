# 04: Generate grounded cited answers

**What to build:** A learner receives a concise answer synthesized only from
retrieved learning passages, with citations or an explicit evidence fallback.

**Blocked by:** 03: Retrieve evidence for learning questions.

**Status:** implemented (MVP; limitations listed below)

- [x] Optional LLM calls receive only the question, top retrieved evidence, and
      fixed system instructions; deterministic local mode remains the default.
- [x] Evidence-based answers return visible citations and speakable text.
- [x] Unsupported or out-of-corpus questions use the standard no-evidence
      response.
- [x] The response contract separates answer text, source IDs, excerpts,
      confidence, and fallback state.
- [x] Prompt-injection text inside sources is treated as untrusted; no tools are
      available to the model.
- [x] Tests cover grounded answers, missing evidence, conflicting-source
      isolation, uncited answers, and citation accuracy.
- [x] Provider credentials are externalized and absent from source code and logs.
- [ ] Detect and explicitly report when multiple retrieved sources disagree.
- [ ] Independently verify semantic claim support; citation membership alone
      does not prove that generated claims follow from the cited passage.
