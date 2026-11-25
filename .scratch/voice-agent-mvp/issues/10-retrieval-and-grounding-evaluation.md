# 10: Build retrieval and grounding evaluation

**What to build:** The project has a repeatable QA suite that measures whether
questions retrieve the right learning evidence and receive grounded answers.

**Blocked by:**
- 03: Retrieve evidence for learning questions.
- 04: Generate grounded cited answers.

**Status:** ready-for-agent

- [ ] Evaluation fixtures contain question, expected source, and worked answer.
- [ ] Metrics include retrieval hit, citation correctness, grounded-answer
      correctness, fallback correctness, and latency.
- [ ] Hallucinated claims are detected against cited passages.
- [ ] Leadership communication and QA engineering examples are covered.
- [ ] Unit and retrieval tests run without model or voice-provider credentials.
- [ ] One command produces a redacted local evidence report.
- [ ] Out-of-corpus and conflicting-source cases are explicit pass/fail groups.

