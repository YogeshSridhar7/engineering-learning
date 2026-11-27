# 07: Connect browser learning UI to the API

**What to build:** The browser learning screen runs through the real text
learning-session API and displays answer, citations, and transcript state.

**Blocked by:**
- 05: Maintain a text learning session.
- 06: Add the learning browser interface.

**Status:** implemented

- [x] Starting a session creates a real API-backed learning session.
- [x] Questions are sent to the text session API.
- [x] Answer, fallback, citations, and source excerpts render in the UI.
- [x] Show conversation reveals the actual session transcript.
- [x] Session and provider errors produce visible retry or stop states.
- [x] Browser tests complete the known-answer and no-evidence journeys.
