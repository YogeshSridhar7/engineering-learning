# Voice Agent Testing Prompt

## Objective

Create or analyse a testing strategy for an AI voice agent.

Use a layer-by-layer engineering approach.

## System Model

Assume the architecture may contain:

Caller
→ telephony / audio transport
→ VAD / endpointing
→ STT
→ LLM / agent
→ tool or API call
→ business backend
→ response generation
→ TTS
→ caller

## Test Dimensions

Evaluate:

### Audio Layer
- input quality
- clipping
- packet loss
- codec behaviour
- background noise

### VAD / Turn Taking
- speech start detection
- end-of-turn detection
- pauses
- hesitation
- barge-in
- interruption handling

### STT
- transcription accuracy
- accents
- names
- dates
- times
- numbers
- specialist vocabulary
- noisy environments
- partial vs final transcripts

### Agent / LLM
- intent recognition
- entity extraction
- conversation context
- ambiguity handling
- instruction following
- hallucination
- confirmation behaviour

### Tool / API Calls
- correct tool selection
- correct parameters
- retries
- timeouts
- duplicate requests
- backend failures
- authentication errors

### TTS
- pronunciation
- pacing
- pauses
- tone
- number/date rendering
- streaming quality
- interruption behaviour

### Performance
Measure:
- time to first transcript
- endpointing latency
- LLM time to first token
- tool latency
- TTS time to first audio
- total turn latency

### Safety / Security
Test:
- prompt injection
- unauthorised actions
- sensitive-data exposure
- incorrect tool execution
- identity / access control

## Output

Produce:

1. test strategy
2. test matrix
3. happy-path scenarios
4. negative scenarios
5. edge cases
6. regression scenarios
7. metrics to capture
8. evidence required
9. defect classification approach
10. example test cases

Use concise engineering language.