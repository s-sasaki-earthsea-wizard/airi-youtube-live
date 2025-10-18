# Session: YouTube Live Streaming Test

**Date**: 2025-10-18
**Branch**: `test/init-youtube-streaming`
**Status**: Blocked (YouTube API Quota Exceeded)

## Overview

YouTube Live配信を実際に行い、youtube-botとstage-webの統合動作を検証しました。youtube-botはYouTube Live Chatからメッセージを正常に取得しAIRI Serverへ転送できていますが、stage-webでメッセージが表示されない問題が発見されました。また、短いポーリング間隔（10秒）によりYouTube Data API v3のクォータが超過しました。

## Objectives

1. 実際のYouTube Live配信でコメント取得を検証
2. youtube-bot → AIRI Server → stage-webのメッセージフローを確認
3. stage-webでのメッセージ表示とLLM自動応答を確認
4. 音声出力がOBSで正常に動作することを確認

## Test Environment

### YouTube Live Stream
- **Stream 1**: VIDEO_ID `_uWNpWJXD5Q` (11:09頃にチャット接続失敗)
- **Stream 2**: VIDEO_ID `eKL4gWxG2iU` (新規作成、テストに使用)
- **Broadcasting Tool**: OBS (Open Broadcaster Software)
- **Browser**: OBS内蔵ブラウザでstage-web表示

### Configuration
- **YouTube API Key**: [REDACTED - see .env file]
- **Polling Interval**: 10000ms (10秒) - クォータ消費が大きすぎる
- **AIRI Server**: ws://localhost:6121/ws
- **Auto Response**: Enabled (`VITE_AUTO_RESPONSE_ENABLED=true`)

## Test Results

### ✅ Working Components

1. **youtube-bot Connection to AIRI Server**
   - WebSocket接続成功 (lsofで確認: pid 96783 → pid 94020)
   - メッセージ転送ログ確認:
     ```
     [11:46:27] Message forwarded to AIRI Server
     [11:50:52] Message forwarded to AIRI Server
     [11:51:43] Message forwarded to AIRI Server
     ```

2. **stage-web WebSocket Connection**
   - Browser DevTools NetworkタブでWebSocket接続確立を確認
   - `module:announce` メッセージ送信成功
   - `possibleEvents: ["input:text"]` リスナー登録

3. **Idle Talk Feature**
   - OBS内ブラウザで音声出力確認済み
   - Knowledge DBからのランダム話題取得正常
   - TTS音声再生正常

### ❌ Issues Discovered

#### Issue 1: Messages Not Appearing in stage-web UI (CRITICAL)

**Symptom**: YouTube Liveチャットに送ったコメントがstage-webのチャット欄に表示されない

**Investigation**:
1. youtube-botログ確認: メッセージ転送成功
   - "好きな作家について教えて！"
   - "好きな作家は誰ですか？"
   - "好きな漫画は？"

2. WebSocket接続確認 (lsof):
   ```
   OBS Helper: 2 connections to :6121
   Brave Browser: 2 connections to :6121
   node 94020 (AIRI Server): 5 listening connections
   node 96783 (youtube-bot): 1 connection to :6121
   ```

3. Browser DevTools確認:
   - WebSocket接続: ✅ Active
   - Outgoing messages: ✅ `module:announce` 送信確認
   - Incoming messages: ❌ `input:text` イベント受信なし

**Root Cause Hypothesis**:
AIRI Server (`packages/server-runtime/src/index.ts`) のメッセージブロードキャスト機構に問題がある可能性。WebSocket接続は確立されているが、youtube-botから送信された`input:text`イベントがstage-webにブロードキャストされていない。

**Affected Files**:
- `/packages/server-runtime/src/index.ts:156-174` - Message broadcast logic
- `/services/youtube-bot/src/handlers/message-handler.ts:20-41` - Message forwarding
- `/apps/stage-web/src/composables/websocket-client.ts:71-100` - Event listener

**Screenshots**:
- `screenshots-for-claude/スクリーンショット 2025-10-18 20.56.02.png` - Network tab showing 6 WebSocket connections
- `screenshots-for-claude/スクリーンショット 2025-10-18 20.57.49.png` - WebSocket Messages tab (client.ts:112)
- `screenshots-for-claude/スクリーンショット 2025-10-18 21.00.07.png` - `module:announce` message sent
- `screenshots-for-claude/スクリーンショット 2025-10-18 21.03.20.png` - ws://localhost:6121/ws browser access error (expected)

#### Issue 2: YouTube API Quota Exceeded (CRITICAL - RESOLVED)

**Symptom**:
- 11:53:32から "you have exceeded your quota" エラー
- **2025/10/19 0:00:59に一瞬で10,000ユニット全て消費**（Google Cloud Console確認）

**Root Cause Analysis**:

**初期仮説（誤り）**:
- ~~10秒ポーリングで1日43,200ユニット消費~~
- ~~約6時間で10,000ユニット消費の計算~~

**実際の原因（確定）**:
- **複数のyoutube-botプロセスが同時にポーリング**していた
- `make stream`を複数回実行時、古いプロセスを停止せずに新規起動
- シェル履歴確認: `make stream`が10回以上実行されている記録
- 推定: 3-5個のプロセス × 10秒ポーリング = 一瞬で大量消費

**計算例**:
```
1プロセス: 6リクエスト/分 × 5ユニット = 30ユニット/分 = 1,800ユニット/時間
3プロセス: 18リクエスト/分 × 5ユニット = 90ユニット/分 = 5,400ユニット/時間
5プロセス: 30リクエスト/分 × 5ユニット = 150ユニット/分 = 9,000ユニット/時間

→ 5プロセスなら約1時間で10,000ユニット消費（理論値と一致）
```

**Evidence**:
1. Google Cloud Consoleグラフで2025/10/19 0:00:59に急激なスパイク
2. シェル履歴: 10回以上の`make stream`実行記録
3. プロセス停止処理が`make stream`に含まれていなかった
4. `stream-stop`と`stop`の重複コード（保守性の問題）

**Solution Implemented**:

1. **Makefile改善** - 起動前に既存プロセスを確実に停止
   ```makefile
   # 共通の停止処理を作成（プロセス数カウント機能付き）
   stop-all:
       @echo "🛑 Stopping all AIRI services..."
       @count=0; \
       for proc in "server-runtime" "stage-web" "youtube-bot"; do \
           num=$$(pgrep -f "$$proc" | wc -l); \
           if [ $$num -gt 0 ]; then \
               echo "  Stopping $$num process(es) for $$proc..."; \
               pkill -f "$$proc" || true; \
               count=$$((count + num)); \
           fi; \
       done; \
       sleep 1; \
       if [ $$count -gt 0 ]; then \
           echo "✅ Stopped $$count process(es)"; \
       else \
           echo "✅ No processes running"; \
       fi

   # streamターゲットで起動前に呼び出し
   stream:
       @make stop-all  # ← 追加
       ...起動処理...

   # エイリアス化
   stream-stop: stop-all
   stop: stop-all
   ```

2. **環境変数設定** - ポーリング間隔を60秒に変更済み
   ```env
   POLLING_INTERVAL_MS=60000
   ```
   - 1プロセスのみ: 1リクエスト/分 × 5ユニット = 300ユニット/時間 = 7,200ユニット/日
   - **クォータ内に収まる**

3. **運用改善**:
   - `make stream`実行時に自動で既存プロセスを停止（手動操作不要）
   - プロセス数をカウントして表示（多重起動の早期発見）
   - 共通処理化により保守性向上

**Benefits**:
- ✅ 多重起動による意図しないクォータ消費を防止
- ✅ `make stop-all`で開発中にプロセスを一括停止可能
- ✅ プロセス数表示により問題の早期発見が可能
- ✅ コード重複削減（DRY原則）

**Related Commits**:
- [b4837543](https://github.com/s-sasaki-earthsea-wizard/airi-youtube-live/commit/b4837543) - Adaptive polling strategy documentation
- 2025-10-19: Makefile改善（stop-all共通ターゲット追加）

#### Issue 3: Initial Auto-Response Configuration Missing

**Symptom**: stage-webが外部メッセージに自動応答しない

**Fix Applied**: `apps/stage-web/.env`に環境変数追加
```env
VITE_AUTO_RESPONSE_ENABLED=true
```

**Status**: ✅ Resolved

## Architecture Analysis

### Message Flow

```
YouTube Live Chat
    ↓
youtube-bot (Polling: 10s interval)
    ↓
YouTube Data API v3 (liveChatMessages.list)
    ↓
MessageHandler.handleMessage()
    ↓
AIRIClient.send({ type: 'input:text', data: {...} })
    ↓
AIRI Server WebSocket (ws://localhost:6121/ws)
    ↓ [BROADCAST FAILURE HERE]
    ↓
stage-web WebSocket Client
    ↓
onEvent('input:text', async (event) => {...})
    ↓
ChatStore.messages.push(...)
    ↓
Auto-response: ChatStore.send(...)
    ↓
LLM Response + TTS Audio
```

### Connection Topology (lsof Analysis)

```
┌─────────────────┐
│  OBS Helper     │──┐
│  (2 conns)      │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │     ┌──────────────────┐
│ Brave Browser   │──┼────→│  AIRI Server     │
│ (2 conns)       │  │     │  node 94020      │
└─────────────────┘  │     │  :6121           │
                     │     │  (5 listeners)   │
┌─────────────────┐  │     └──────────────────┘
│ youtube-bot     │──┘              ↑
│ node 96783      │                 │
│ (1 conn)        │─────────────────┘
└─────────────────┘
```

### WebSocket Event Sequence

**Expected Sequence**:
1. stage-web → AIRI Server: `module:announce` with `possibleEvents: ["input:text"]`
2. youtube-bot → AIRI Server: `input:text` with message data
3. AIRI Server → stage-web: Broadcast `input:text` to all authenticated peers
4. stage-web: Handle `input:text` event, add to chat, trigger auto-response

**Actual Sequence**:
1. ✅ stage-web → AIRI Server: `module:announce`
2. ✅ youtube-bot → AIRI Server: `input:text`
3. ❌ AIRI Server → stage-web: **Broadcast fails** (no messages received)
4. ❌ stage-web: No event handler triggered

## Code Locations

### Message Forwarding (youtube-bot)
**File**: `services/youtube-bot/src/handlers/message-handler.ts:20-41`

```typescript
async handleMessage(chatMessage: YouTubeLiveChatMessage): Promise<void> {
  log
    .withField('author', chatMessage.authorName)
    .withField('message', chatMessage.message)
    .withField('type', chatMessage.type)
    .log('Processing YouTube chat message')

  try {
    // Forward YouTube comment to stage-web
    this.airiClient.send({
      type: 'input:text',
      data: {
        text: chatMessage.message,
        author: chatMessage.authorName,
        source: 'youtube',
        timestamp: chatMessage.timestamp,
        youtube: {
          messageType: chatMessage.type,
          superChatDetails: chatMessage.superChatDetails,
        },
      },
    })

    log.withField('messageId', chatMessage.id).log('Message forwarded to AIRI Server')
  }
  catch (error) {
    log.withError(error).error('Failed to forward message to AIRI Server')
  }
}
```

### Broadcast Logic (AIRI Server)
**File**: `packages/server-runtime/src/index.ts:156-174`

```typescript
// default case - broadcast to all peers
const p = peers.get(peer.id)
if (!p?.authenticated) {
  websocketLogger.withFields({ peer: peer.id }).debug('not authenticated')
  peer.send(RESPONSES.notAuthenticated)
  return
}

const payload = JSON.stringify(event)
for (const [id, other] of peers.entries()) {
  if (id === peer.id)
    continue
  if (other.peer.readyState === WebSocketReadyState.OPEN) {
    other.peer.send(payload)  // ← This should broadcast to stage-web
  }
  else {
    peers.delete(id)
    unregisterModulePeer(other)
  }
}
```

### Event Handler (stage-web)
**File**: `apps/stage-web/src/composables/websocket-client.ts:71-100`

```typescript
// Receive text input from YouTube/Discord/Telegram (user comments)
airiClient.onEvent('input:text', async (event) => {
  const { text, author, source } = event.data

  console.info('[WebSocket] Received input:text event:', { text, author, source })

  try {
    // Add user message to chat store
    chatStore.messages.push({
      role: 'user',
      content: text,
      author,
      source,
    })

    // Automatically generate AI response if enabled
    if (autoResponseEnabled) {
      console.info('[WebSocket] Auto-response enabled, generating AI response...')
      await chatStore.send(text, { model: llmModel, chatProvider: providerInstance, providerConfig })
      console.info('[WebSocket] AI response generated successfully')
    }
  }
  catch (error) {
    console.error('[WebSocket] Error handling input:text:', error)
  }
})
```

## Files Modified

### Modified Files
- `services/youtube-bot/.env` - Updated VIDEO_ID to `eKL4gWxG2iU`
- `apps/stage-web/.env` - Added `VITE_AUTO_RESPONSE_ENABLED=true`
- `apps/stage-web/.env.example` - Documented auto-response configuration

### New Files
- `.claude-notes/sessions/2025-10-18-youtube-live-test.md` - This session note

## Next Steps (Blocked by API Quota)

### Immediate Actions Required

1. **Wait for YouTube API Quota Reset**
   - Quota resets at midnight Pacific Time (daily)
   - Alternative: Create new Google Cloud Project with fresh API key

2. **Add Debug Logging to AIRI Server**
   ```typescript
   // In packages/server-runtime/src/index.ts
   console.log('[AIRI Server] Broadcasting event:', {
     type: event.type,
     fromPeer: peer.id,
     toPeers: Array.from(peers.keys()).filter(id => id !== peer.id)
   })

   for (const [id, other] of peers.entries()) {
     if (id === peer.id) continue
     console.log('[AIRI Server] Sending to peer:', {
       peerId: id,
       authenticated: other.authenticated,
       readyState: other.peer.readyState
     })
     // ...
   }
   ```

3. **Verify Authentication Status**
   - Check if youtube-bot's messages are properly authenticated
   - Verify `peers.get(peer.id)?.authenticated === true` for youtube-bot

4. **Test Message Injection**
   - Use browser console to manually send `input:text` event
   - Isolate if issue is youtube-bot-specific or general broadcast problem:
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://localhost:6121/ws')
   ws.onopen = () => {
     ws.send(JSON.stringify({
       type: 'input:text',
       data: {
         text: 'Test message',
         author: 'Test User',
         source: 'test'
       }
     }))
   }
   ```

### Configuration Changes Needed

**File**: `services/youtube-bot/.env`
```env
# Increase polling interval to conserve quota
POLLING_INTERVAL_MS=60000  # Changed from 10000 to 60000 (60 seconds)
```

**Expected Impact**:
- Quota usage: ~7,200 units/day (within 10,000 limit)
- Message latency: Up to 60 seconds delay
- User experience: Acceptable for live streaming use case

## Lessons Learned

1. **YouTube API Quota Management**
   - Default 10,000 units/day is easily exceeded with short polling intervals
   - Need to balance responsiveness vs. quota consumption
   - Consider implementing adaptive polling based on chat activity

2. **WebSocket Debugging**
   - Browser DevTools Network tab is essential for WebSocket debugging
   - `lsof` command confirms connection establishment at OS level
   - Message tab shows actual data flow (or lack thereof)

3. **Message Broadcast Architecture**
   - AIRI Server's broadcast logic needs comprehensive logging
   - Authentication state affects message routing
   - Peer registration and announcement protocol critical for message delivery

4. **Testing Strategy**
   - Live testing reveals issues not apparent in development
   - Need local testing tools that simulate YouTube bot messages
   - Quota limits make iterative testing difficult

## Related Sessions

- [2025-10-10: YouTube Live Chat Integration](./2025-10-10-youtube-integration.md) - Initial implementation
- [2025-10-17: YouTube Bot Stage-Web Integration](./2025-10-17-youtube-bot-stage-web-integration.md) - Auto-response feature
- [2025-10-17: Idle Talk with Knowledge DB](./2025-10-17-idle-talk.md) - Idle talk feature (confirmed working)

## References

- [YouTube Data API Quota](https://developers.google.com/youtube/v3/determine_quota_cost)
- [AIRI Server Runtime](../../packages/server-runtime/src/index.ts)
- [WebSocket Client SDK](../../packages/server-sdk/src/client.ts)
- [Adaptive Polling Strategy](https://github.com/s-sasaki-earthsea-wizard/airi-youtube-live/commit/b4837543)

---

**Session Status**: Blocked - Waiting for YouTube API quota reset
**Critical Issue**: Message broadcast from AIRI Server to stage-web failing
**Next Session**: Debug broadcast logic with comprehensive logging after quota reset
