# 03: Retrieve evidence for learning questions

**What to build:** A learner's question finds the relevant passages and source
IDs from the selected knowledge collection.

**Blocked by:** 02: Import approved learning sources.


- [ ] Embedding and vector-store implementations are replaceable adapters.
- [ ] Retrieval returns source IDs, excerpts, rank, and retrieval metadata.
- [ ] Known-answer questions retrieve the expected evidence source.
- [ ] Paraphrased and spelling-varied questions remain testable.
- [ ] Out-of-corpus questions return no sufficiently relevant evidence.
- [ ] Conflicting or ambiguous sources remain visible instead of being silently
      merged.
- [ ] Tests cover retrieval hits, misses, source filters, and limits.
