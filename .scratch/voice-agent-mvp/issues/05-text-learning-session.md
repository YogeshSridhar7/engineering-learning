# 05: Maintain a text learning session

**What to build:** A learner can ask text questions and follow-ups within an
isolated learning session before browser voice is connected.

**Blocked by:** 04: Generate grounded cited answers.

**Status:** implemented

- [x] Each session has an opaque ID and isolated conversation context.
- [x] Short follow-up questions retain only approved recent-turn context.
- [x] Session reset clears conversation state.
- [x] Empty, malformed, and long text inputs produce safe responses.
- [x] Typed questions use the same answer service and source contract as voice.
- [x] Tests cover a learning topic, follow-up turn, session isolation, reset,
      fallback, and provider failure.

Sessions are in-memory, expire after one hour of inactivity, and are limited to
500 active sessions and 20 stored turns per session. This MVP has no
authentication or persistence and is not suitable for public exposure.
