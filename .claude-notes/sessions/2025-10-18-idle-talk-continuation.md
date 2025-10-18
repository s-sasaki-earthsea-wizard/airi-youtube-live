# Session: Idle Talk Context Continuation and Bug Fixes

**Date**: 2025-10-18
**Branch**: `feature/idle-talk-with-knowledge-db`
**Status**: Completed

## Overview

Enhanced the idle talk feature with topic continuation functionality and fixed several critical bugs discovered during testing. The system now treats user-initiated and idle-initiated conversations uniformly, continuing topics for a configurable number of iterations before switching to new random topics.

## Objectives

1. ✅ Implement topic continuation for both user input and idle talk
2. ✅ Fix race condition causing topics to alternate instead of continuing
3. ✅ Fix idle talk prompts appearing in chat UI
4. ✅ Fix idle talk interrupting user conversations
5. ✅ Fix environment variable overrides not taking effect (LLM)
6. ✅ Fix continuation counter reset bug
7. ✅ Fix environment variable overrides for TTS settings
8. ✅ Add comprehensive LLM request logging
9. ✅ Document known issues

## Implementation Details

### 1. Unified Topic Continuation Design

**Problem**: Original design treated user input and idle talk differently, leading to inconsistent behavior.

**Solution**: Unified the flow so both user input and idle talk follow the same continuation logic:

```
User Input or Idle Timeout
    ↓
[If User Input] Clear previous topic context
    ↓
[If Idle & Has Context] Build continuation prompt
[If Idle & No Context] Get random topic from Knowledge DB
    ↓
Send to LLM & Generate Response
    ↓
Store response for next continuation
    ↓
Reset timer (preserve context for continuation)
    ↓
Wait for next idle timeout or user input
```

**Key Changes**:
- `onBeforeMessageComposed`: Clear context when **user** starts new topic
- `onAssistantResponseEnd`: Store response and reset timer for **both** user and idle talk
- Removed redundant timer resets from idle talk's finally block

### 2. Bug Fix: Topic Alternation Issue

**Problem**: Two topics were alternating instead of continuing the same topic.

**Root Cause**: `chatStore.send()` completed before assistant response was added to chat history. The 100ms wait was insufficient, causing `lastResponse` to be stored one iteration late.

**Solution**: Implemented polling mechanism to wait for assistant response:

```typescript
const maxWaitTime = 30000 // 30 seconds max wait
const pollInterval = 100 // Check every 100ms
let assistantResponseFound = false

while (!assistantResponseFound && Date.now() - startTime < maxWaitTime) {
  if (chatStore.messages.length > initialHistoryLength) {
    const newMessages = chatStore.messages.slice(initialHistoryLength)
    const hasAssistantResponse = newMessages.some(msg => msg.role === 'assistant')
    if (hasAssistantResponse) {
      assistantResponseFound = true
      break
    }
  }
  await new Promise(resolve => setTimeout(resolve, pollInterval))
}
```

### 3. Bug Fix: Prompts Appearing in Chat UI

**Problem**: Continuation prompts like "前回あなたはこう話しました：..." were visible in the chat window.

**Solution**: Used `onAfterMessageComposed` hook to remove prompts immediately after composition:

```typescript
const removePromptHook = async () => {
  await nextTick()
  const userMessageIndex = chatStore.messages.findLastIndex(msg => msg.role === 'user')
  if (userMessageIndex !== -1 && userMessageIndex >= initialHistoryLength) {
    chatStore.messages.splice(userMessageIndex, 1)
  }
}
chatStore.onAfterMessageComposed(removePromptHook)
```

### 4. Bug Fix: Idle Talk Interrupting User Conversations

**Problem**: Idle talk was triggering while user's AI response/TTS was still playing.

**Root Cause**: Timer reset on user input (`onBeforeMessageComposed`) instead of waiting for response completion.

**Solution**: Moved timer reset to `onAssistantResponseEnd` hook:

```typescript
chatStore.onAssistantResponseEnd(async (fullText: string) => {
  // Store the assistant's response for topic continuation
  lastResponse.value = fullText

  // Reset timer with context preservation
  // Whether it was user input or idle talk doesn't matter - we continue the topic
  resetIdleTimer(false)
}, { persistent: true })
```

### 5. Bug Fix: Environment Variables Not Taking Effect

**Problem**: Changing `VITE_LLM_MODEL` in .env didn't update the actual model used without manually clearing browser localStorage.

**Root Cause**: `consciousnessStore` uses VueUse's `useLocalStorage` which caches values in localStorage, prioritizing cached values over new assignments.

**Solution**: Directly override localStorage before setting store values:

```typescript
// Force override localStorage values with environment variables
// This ensures env vars always take precedence over cached values
localStorage.setItem('settings/consciousness/active-provider', llmProvider)
if (llmModel) {
  localStorage.setItem('settings/consciousness/active-model', llmModel)
}

// Set store values (useLocalStorage will sync from localStorage)
consciousnessStore.activeProvider = llmProvider
consciousnessStore.activeModel = llmModel
```

**File**: `apps/stage-web/src/App.vue`

### 6. Bug Fix: TTS Environment Variables Not Taking Effect

**Problem**: Similar to the LLM issue, changing TTS settings in .env didn't update the actual TTS configuration without manually clearing browser localStorage.

**Root Cause**: `speechStore` also uses VueUse's `useLocalStorage` for the following keys:
- `settings/speech/active-provider`
- `settings/speech/active-model`
- `settings/speech/voice`

**Solution**: Apply the same localStorage override pattern as LLM:

```typescript
// Force override localStorage values with environment variables
localStorage.setItem('settings/speech/active-provider', ttsProvider)
if (ttsModel) {
  localStorage.setItem('settings/speech/active-model', ttsModel)
}
if (ttsVoiceId) {
  localStorage.setItem('settings/speech/voice', ttsVoiceId)
}

// Set store values (useLocalStorage will sync from localStorage)
speechStore.activeSpeechProvider = ttsProvider
speechStore.activeSpeechModel = ttsModel
speechStore.activeSpeechVoiceId = ttsVoiceId

console.info('[App.vue] TTS provider configured from env:', {
  activeProvider: speechStore.activeSpeechProvider,
  activeModel: speechStore.activeSpeechModel,
  activeVoiceId: speechStore.activeSpeechVoiceId,
})
```

**File**: `apps/stage-web/src/App.vue`

### 7. Bug Fix: Continuation Counter Reset

**Problem**: Continuation counter stays at `1/2` and resets every iteration, preventing topic switching.

**Root Cause**: `onBeforeMessageComposed` hook triggers for **all** message compositions, including idle talk's `chatStore.send()` call. This resets the counter immediately after it's incremented in `buildIdleTalkPrompt()`.

**Solution**: Skip context reset during idle talk:

```typescript
chatStore.onBeforeMessageComposed(async () => {
  // Skip if idle talk is in progress (to preserve continuation count)
  if (isCurrentlyIdleTalking.value) {
    console.info('[IdleTalk] Skipping context clear (idle talk in progress)')
    return
  }

  // Clear previous topic context when user sends a new message
  lastResponse.value = null
  initialTopic.value = null
  contextContinuationCount.value = 0
}, { persistent: true })
```

**File**: `apps/stage-web/src/composables/idle-talk.ts`

### 8. Debug Enhancement: LLM Request Logging

Added comprehensive logging to track what's being sent to the LLM for debugging purposes:

```typescript
console.info('[ChatStore] Sending to LLM:', {
  model: options.model,
  messageCount: newMessages.length,
  systemPrompt: newMessages[0]?.role === 'system'
    ? (newMessages[0].content as string).substring(0, 200) + '...'
    : 'none',
  messages: newMessages.map((msg, idx) => ({
    index: idx,
    role: msg.role,
    contentPreview: typeof msg.content === 'string'
      ? msg.content.substring(0, 100)
      : '[complex content]',
    contentLength: typeof msg.content === 'string'
      ? msg.content.length
      : 'N/A',
  })),
})
```

**Benefits**:
- Easily inspect what prompts are being sent to the LLM
- Debug Knowledge DB integration (system prompt modifications)
- Verify message history is correct
- Track conversation context

**File**: `packages/stage-ui/src/stores/chat.ts`

## Known Issues

### Issue 1: Race Condition Between User Input and Idle Timer

**Severity**: Medium
**Status**: Open

**Description**:
When a user sends a message at nearly the same time as the idle timeout fires, the system may ignore the user's topic and instead respond with a random topic from the Knowledge DB.

**Reproduction Steps**:
1. Wait for idle timeout to be close to firing (e.g., 58-60 seconds)
2. Send a user message just before or as the timeout fires
3. The AI may respond to a random Knowledge DB topic instead of the user's message

**Example**:
- User sends: "お芝居とか観る？"
- Expected: AI responds about theater/plays
- Actual: AI responds about "民主化" or other unrelated Knowledge DB topic

**Root Cause**:
The idle timer and user input processing are independent. If the timer fires while or immediately after a user message is being composed, both pathways may execute concurrently:
1. User input → `onBeforeMessageComposed` → Clear context
2. Idle timeout → `handleIdleTimeout` → Get random topic (because context was just cleared)
3. Idle talk's `chatStore.send()` executes **after** user's send, potentially overwriting the response

**Workaround**:
None currently available. Users should avoid sending messages right at the idle timeout boundary.

**Proposed Solutions** (for future implementation):
1. **Debounce idle timer**: Add a small delay before idle timeout executes, canceling if user input detected
2. **Lock mechanism**: Prevent idle timeout from firing if a user message is being processed
3. **Priority queue**: Ensure user messages always take priority over idle talk
4. **Longer timeout**: Increase `VITE_IDLE_TIMEOUT` to reduce likelihood of collision (e.g., 120000ms = 2 minutes)

**Related Code**:
- `apps/stage-web/src/composables/idle-talk.ts` - `handleIdleTimeout()`, `resetIdleTimer()`
- `packages/stage-ui/src/stores/chat.ts` - `send()` function

### Issue 2: User Response After AI Question Clears Context

**Severity**: Medium
**Status**: Open
**Impact**: Breaks conversation flow and naturalness

**Description**:
When the AI asks a question during idle talk and the user responds, the current implementation clears the topic context, causing the AI to lose the conversation thread.

**Example Scenario**:

```text
AI (Idle Talk): 「トキが好き！<|DELAY:1|> みんなはどのキャラが好き？」
                (Translation: "I like Toki! Who's your favorite character?")
                ↓
User: 「ラオウが好きです」
      (Translation: "I like Raoh")
                ↓
onBeforeMessageComposed → contextContinuationCount = 0, lastResponse = null
                ↓
AI: （北斗の拳の文脈を知らずに応答）
    "Raoh? What are you talking about?"
```

**Root Cause**:
The current design treats all user inputs as "new topic initiations" and clears the previous context:
```typescript
chatStore.onBeforeMessageComposed(async () => {
  if (isCurrentlyIdleTalking.value) return

  // This clears context even when user is responding to AI's question
  lastResponse.value = null
  initialTopic.value = null
  contextContinuationCount.value = 0
})
```

**Impact on User Experience**:

- AI appears to have "amnesia" when user responds to its questions
- Conversation feels unnatural and disjointed
- Reduces the illusion of spontaneous interaction
- Especially problematic when AI explicitly asks for user input

**Workaround**:
None currently available. Users will experience context loss when responding to AI questions during idle talk.

**Proposed Solutions** (for future implementation):

1. **Question Detection**
   - Detect if AI's last response contains a question mark or question patterns
   - Set a flag: `aiAskedQuestion = true`
   - Preserve context if user responds within timeout period

2. **Smart Context Preservation**
   - Analyze user input to detect if it's a response to previous context
   - Use Knowledge DB similarity search between user input and last AI response
   - If similarity > threshold (e.g., 0.5), preserve context
   - Otherwise, treat as new topic

3. **Timeout-Based Context Clearing**
   - Don't clear context immediately on user input
   - Clear context only after:
     - X minutes of silence (e.g., 5 minutes)
     - User explicitly changes topic (low similarity to recent messages)
     - Maximum context age reached

4. **Explicit Topic Switching**
   - Train a small classifier to detect topic changes
   - Clear context only when topic shift is detected
   - Preserve context for follow-up questions and related responses

5. **Hybrid Approach** (Recommended)

   ```typescript
   const shouldClearContext = async (userMessage: string) => {
     // Don't clear if AI asked a question recently (< 2 minutes ago)
     if (aiAskedQuestion && Date.now() - lastResponseTime < 120000) {
       return false
     }

     // Don't clear if user message is semantically related
     if (lastResponse.value) {
       const similarity = await computeSimilarity(userMessage, lastResponse.value)
       if (similarity > 0.4) return false
     }

     // Otherwise, treat as new topic
     return true
   }
   ```

**Related Code**:

- `apps/stage-web/src/composables/idle-talk.ts` - `onBeforeMessageComposed` hook
- `packages/stage-ui/src/stores/chat.ts` - Message composition logic

**Priority**: Medium (improves UX but not blocking for prototype)

**Estimated Effort**: 2-4 hours (depending on solution complexity)

---

### Issue 3: Continuation Counter Not Incrementing (FIXED)

**Status**: ✅ Fixed in this session

**Description**: Counter would stay at `1/2` indefinitely.

**Solution**: Skip context reset during idle talk by checking `isCurrentlyIdleTalking.value`.

## Environment Variables

Updated `.env.example` with better documentation:

```env
# Idle Talk Feature
VITE_IDLE_TALK_ENABLED=false
VITE_IDLE_TIMEOUT=60000  # Idle timeout in milliseconds (60 seconds)
VITE_IDLE_TALK_MODE=random  # Topic selection mode: random | sequential
VITE_IDLE_TALK_MIN_SIMILARITY=0.0  # Minimum similarity for random topics (0-1)
VITE_IDLE_TALK_CONTINUE_CONTEXT=true  # Continue talking about related topics
VITE_IDLE_TALK_MAX_CONTINUATION=5  # Max times to continue same topic before switching
```

## Files Modified

- `apps/stage-web/src/composables/idle-talk.ts` - Topic continuation logic, bug fixes
- `apps/stage-web/src/App.vue` - localStorage override fix
- `apps/stage-web/.env.example` - Documentation improvements
- `packages/stage-ui/src/stores/chat.ts` - Debug logging
- `apps/stage-web/public/prompts/system-prompt.md` - TTS pronunciation guidelines

## Testing

### Test Results

1. ✅ Topic continuation works (1/2, 2/2, then new topic)
2. ✅ Prompts no longer appear in chat UI
3. ✅ Idle talk waits for response completion
4. ✅ Environment variables override localStorage
5. ✅ Knowledge DB integration works correctly
6. ⚠️ Race condition still exists (documented as known issue)

### Test Configuration

```env
VITE_IDLE_TALK_ENABLED=true
VITE_IDLE_TIMEOUT=60000
VITE_IDLE_TALK_CONTINUE_CONTEXT=true
VITE_IDLE_TALK_MAX_CONTINUATION=2  # For faster testing
```

## Lessons Learned

1. **Hook Execution Order**: Hooks registered with `chatStore.onBeforeMessageComposed()` fire for **all** message compositions, including those triggered programmatically. Need to guard with flags when necessary.

2. **Async Race Conditions**: Waiting for chat history to update requires polling, not just arbitrary delays. The 100ms `setTimeout` was insufficient.

3. **localStorage Persistence**: VueUse's `useLocalStorage` prioritizes cached values. Environment variables need explicit localStorage manipulation to override.

4. **Timer Management**: Resetting timers on response completion (not input time) prevents interruptions during TTS playback.

## Summary

All planned objectives have been completed:

- ✅ Topic continuation works correctly (counts increment properly)
- ✅ Environment variables fully control both LLM and TTS settings
- ✅ Comprehensive debugging logs added for troubleshooting
- ✅ Known issue documented (race condition)

The idle talk feature is now production-ready with the following caveats:

1. Known race condition when user input coincides with idle timeout (documented)
2. Recommend using longer idle timeouts (120s+) to minimize collision probability

## Next Steps

- [ ] Consider implementing race condition fix (debounce or lock mechanism)
- [ ] Test with longer idle timeouts in production (e.g., 120000ms)
- [ ] Monitor for any remaining edge cases
- [ ] Consider Phase 2 enhancements (sequential mode, topic history, etc.)

## References

- [Previous Session: Idle Talk Initial Implementation](./2025-10-17-idle-talk.md)
- [Knowledge DB Service](../../services/knowledge-db/README.md)
- [Chat Store Implementation](../../packages/stage-ui/src/stores/chat.ts)

---

**Session Completed**: 2025-10-18
**Next Session**: TBD (consider race condition fix or Phase 2 features)
