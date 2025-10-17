# YouTube Bot & Stage-Web Integration

**Date**: 2025-10-17
**Branch**: `feat/youtube-bot-stage-web-integration`
**Status**: ✅ Completed

## Overview

Simplified youtube-bot by removing LLM/TTS processing and centralizing all AI functionality in stage-web. This follows the same pattern as knowledge-db integration, where external services forward messages to stage-web for processing.

## Architecture Changes

### Before
```
youtube-bot (240 lines)
├── YouTube API polling
├── LLM response generation ❌ (duplicated)
├── TTS audio synthesis ❌ (duplicated)
└── Message forwarding
```

### After
```
youtube-bot (56 lines)
└── YouTube API polling
└── Message forwarding to AIRI Server

         ↓ WebSocket

AIRI Server (event bus)

         ↓ WebSocket

stage-web
├── Auto-response (NEW)
├── LLM response generation
├── TTS audio synthesis
└── Knowledge DB integration (existing)
```

## Phase 1: Simplify youtube-bot

### Changes

1. **Removed LLM/TTS Processing** (`services/youtube-bot/src/handlers/message-handler.ts`)
   - Deleted LLM response generation (77% code reduction: 240 → 56 lines)
   - Deleted TTS audio synthesis
   - Deleted conversation history management
   - Deleted audio file management
   - Now only forwards YouTube comments to AIRI Server

2. **Updated WebSocket Event Types** (`packages/server-shared/src/types/websocket/events.ts`)
   - Added `author`, `source`, `timestamp` to `input:text` event
   - Added YouTube metadata type:
     ```typescript
     interface YouTube {
       messageType?: 'text' | 'super_chat' | 'super_sticker' | 'membership'
       superChatDetails?: {
         amountMicros: string
         currency: string
         tier: number
       }
     }
     ```

3. **Removed Dependencies** (`services/youtube-bot/package.json`)
   - Removed: `@xsai/generate-speech`, `@xsai/generate-text`, `@xsai/utils-chat`
   - Removed: `@xsai-ext/providers-cloud`, `express`, `@types/express`

4. **Updated Configuration** (`services/youtube-bot/.env.example`)
   - Removed: LLM_API_KEY, LLM_MODEL, LLM_API_BASE_URL
   - Removed: TTS_API_KEY, TTS_MODEL, TTS_VOICE
   - Removed: AUDIO_OUTPUT_DIR, HTTP_PORT
   - Kept: YOUTUBE_API_KEY, YOUTUBE_VIDEO_ID, AIRI_SERVER_URL

5. **Updated Documentation** (`services/youtube-bot/README.md`)
   - Updated architecture diagram
   - Clarified separation of concerns
   - Documented that stage-web handles all AI processing

6. **Removed Obsolete Files**
   - Deleted `test-message.ts` (was testing output events)
   - Removed `test-message` script from package.json

### Type System Updates

Extended `WebSocketEvents` to support YouTube metadata:

```typescript
'input:text': {
  text: string
  author?: string
  source?: string
  timestamp?: string
} & Partial<WithInputSource<'browser' | 'discord' | 'youtube'>>
```

## Phase 2: Add Auto-Response to stage-web

### Changes

1. **Auto-Response Logic** (`apps/stage-web/src/composables/websocket-client.ts`)
   - Added `VITE_AUTO_RESPONSE_ENABLED` environment variable check
   - On `input:text` event:
     - Add user message to chat store (with author prefix if available)
     - If auto-response enabled:
       - Read `VITE_LLM_PROVIDER` and `VITE_LLM_MODEL` from environment
       - Get provider instance from providersStore
       - Validate provider is a ChatProvider
       - Call `chatStore.send()` to generate LLM response
   - Removed `output:text` and `output:audio` event handlers (not used)
   - Simplified `possibleEvents` to only `['input:text']`

2. **Environment Variables** (`apps/stage-web/.env.example`)
   - Added `VITE_AUTO_RESPONSE_ENABLED=true`
   - Documented auto-response feature
   - Existing `VITE_LLM_PROVIDER` and `VITE_LLM_MODEL` are reused

### Auto-Response Flow

```
1. youtube-bot receives YouTube comment
2. youtube-bot sends input:text event to AIRI Server
3. AIRI Server forwards to stage-web via WebSocket
4. stage-web receives input:text event
5. If VITE_AUTO_RESPONSE_ENABLED=true:
   a. Add user message to chatStore
   b. Read VITE_LLM_PROVIDER and VITE_LLM_MODEL
   c. Get provider instance
   d. Call chatStore.send()
   e. Knowledge DB hooks execute automatically
   f. LLM streams response
   g. TTS pipeline generates audio
```

## Configuration

### youtube-bot (.env)
```bash
# YouTube API Configuration
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_VIDEO_ID=your-video-id
POLLING_INTERVAL_MS=10000
MAX_MESSAGES_PER_POLL=50

# AIRI Server Configuration
AIRI_SERVER_URL=ws://localhost:6121/ws
AIRI_SERVER_TOKEN=
```

### stage-web (.env)
```bash
# LLM Configuration
VITE_LLM_PROVIDER=openrouter-ai
VITE_LLM_API_KEY=your-openrouter-api-key-here
VITE_LLM_BASE_URL=https://openrouter.ai/api/v1/
VITE_LLM_MODEL=anthropic/claude-3.5-sonnet

# TTS Configuration
VITE_TTS_PROVIDER=elevenlabs
VITE_TTS_API_KEY=your-elevenlabs-api-key-here
VITE_TTS_BASE_URL=https://unspeech.hyp3r.link/v1/
VITE_TTS_MODEL=eleven_v3
VITE_TTS_VOICE_ID=your-voice-id-here

# Auto-Response Configuration (NEW)
VITE_AUTO_RESPONSE_ENABLED=true

# Knowledge Database (existing)
VITE_KNOWLEDGE_DB_ENABLED=true
VITE_KNOWLEDGE_DB_URL=http://localhost:3100
VITE_KNOWLEDGE_DB_LIMIT=3
VITE_KNOWLEDGE_DB_THRESHOLD=0.3
```

## Benefits

1. **Code Reduction**: youtube-bot reduced from 240 to 56 lines (77% smaller)
2. **Centralized AI Processing**: All LLM/TTS logic in stage-web
3. **Knowledge DB Integration**: Automatic RAG for YouTube comments
4. **Reusable Architecture**: Easy to add Discord, Telegram, etc.
5. **Single Configuration**: LLM/TTS settings only in stage-web
6. **Easier Maintenance**: One place to update AI logic

## Testing

To test the integration:

1. Start AIRI Server (usually with stage-web):
   ```bash
   pnpm -F @proj-airi/stage-web dev
   ```

2. Configure stage-web `.env`:
   ```bash
   VITE_AUTO_RESPONSE_ENABLED=true
   VITE_LLM_PROVIDER=openrouter-ai
   VITE_LLM_MODEL=anthropic/claude-3.5-sonnet
   VITE_KNOWLEDGE_DB_ENABLED=true
   ```

3. Configure youtube-bot `.env`:
   ```bash
   YOUTUBE_API_KEY=your-key
   YOUTUBE_VIDEO_ID=your-video-id
   ```

4. Start youtube-bot:
   ```bash
   pnpm -F @proj-airi/youtube-bot start
   ```

5. Post a comment on your YouTube live stream

6. Expected behavior:
   - youtube-bot logs: "Processing YouTube chat message"
   - stage-web logs: "Received input:text event"
   - stage-web logs: "Auto-response enabled, generating AI response..."
   - Knowledge DB query executes (if enabled)
   - LLM generates response
   - TTS synthesizes audio
   - Response appears in stage-web UI

## Files Changed

### Phase 1
- `services/youtube-bot/src/handlers/message-handler.ts` (240 → 56 lines)
- `services/youtube-bot/src/index.ts` (removed LLM/TTS setup)
- `services/youtube-bot/package.json` (removed 5 dependencies)
- `services/youtube-bot/.env.example` (removed LLM/TTS config)
- `services/youtube-bot/README.md` (updated architecture)
- `packages/server-shared/src/types/websocket/events.ts` (added YouTube metadata)
- Deleted: `services/youtube-bot/src/test-message.ts`

### Phase 2
- `apps/stage-web/src/composables/websocket-client.ts` (added auto-response)
- `apps/stage-web/.env.example` (added VITE_AUTO_RESPONSE_ENABLED)

## Type Checking

All type checks pass:
```bash
pnpm -F @proj-airi/youtube-bot typecheck  # ✅ Pass
pnpm -F @proj-airi/stage-web typecheck     # ✅ Pass (websocket-client.ts)
```

## Known Issues

None. All type errors resolved.

## Future Enhancements

1. Add Discord bot following the same pattern
2. Add Telegram bot following the same pattern
3. Add support for posting responses back to YouTube (requires OAuth)
4. Add rate limiting for auto-responses
5. Add user-specific context tracking across platforms

## Related Sessions

- [2025-10-16: Knowledge DB Integration](./.claude-notes/sessions/2025-10-16-knowledge-db-integration.md)
- [2025-10-10: YouTube Live Chat Integration](./.claude-notes/sessions/2025-10-10-youtube-integration.md)

---

**Developed with Claude Code** (Sonnet 4.5)
