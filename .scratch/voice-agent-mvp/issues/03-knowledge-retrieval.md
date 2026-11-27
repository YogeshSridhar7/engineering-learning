# 03: Retrieve evidence for learning questions

**What to build:** A learner's question finds the relevant passages and source
IDs from the selected knowledge collection.

**Blocked by:** 02: Import approved learning sources.

- [x] Embedding and vector-store implementations are replaceable adapters.
- [x] Retrieval returns source IDs, excerpts, rank, and retrieval metadata.
- [x] Known-answer questions retrieve the expected evidence source.
- [x] Paraphrased and spelling-varied questions remain testable.
- [x] Out-of-corpus questions return no sufficiently relevant evidence.
- [x] Conflicting or ambiguous sources remain visible instead of being silently
      merged.
- [x] Tests cover retrieval hits, misses, source filters, and limits.

**Status:** implemented

The default runtime uses the configurable local Ollama embedding provider and
an in-memory cosine-similarity vector store. The index is rebuilt from the
in-memory source collection after restart. The deterministic lexical retriever
remains available for tests, not as a silent runtime fallback.
