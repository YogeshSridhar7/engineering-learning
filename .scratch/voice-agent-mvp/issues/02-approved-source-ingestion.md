# 02: Import approved learning sources

**What to build:** A learner can add approved public, licensed, or owned
documents and have them prepared for grounded retrieval with complete source
metadata.

**Blocked by:** 01: Create the voice-agent project foundation.

**Status:** implemented

- [ ] Source metadata records title, author, URL or document reference,
      licensing basis, retrieval date, and chunk identifiers.
- [ ] Text extraction, bounded chunking, deduplication, and source filtering
      are implemented behind provider-independent ports.
- [ ] Summaries or short excerpts are preferred over full copyrighted content.
- [ ] Employer confidential material and personal health information are
      rejected or never configured for ingestion.
- [ ] Tests cover metadata, chunk boundaries, duplicate chunks, and malformed
      documents.
- [ ] Removing a source can remove all of its derived chunks and future
      retrieval entries.
