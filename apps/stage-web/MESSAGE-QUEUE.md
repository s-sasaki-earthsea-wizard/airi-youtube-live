# Message Queue System

音声再生中の会話中断を防ぐため、受信メッセージをキューイングするシステムです。

## 概要

YouTube Live配信などで、AIが話している最中に新しいコメントが来た場合、従来は会話が中断されていました。このシステムは、音声再生中の新しいメッセージをキューに保存し、再生完了後に順次処理することで、会話の連続性を維持します。

## 機能

- **自動キューイング**: 音声再生中(`nowSpeaking=true`)のメッセージを自動的にキューに追加
- **順次処理**: 音声再生完了後、キューから順番にメッセージを取り出して処理
- **メッセージ損失防止**: すべてのメッセージが確実に処理される
- **リアルタイム性維持**: 音声再生中でなければ即座に処理

## アーキテクチャ

### コンポーネント

1. **`useMessageQueue.ts`** - メッセージキューの管理
   - キューへの追加/取り出し
   - 音声再生状態の監視
   - 処理状態の管理

2. **`websocket-client.ts`** - WebSocketメッセージの受信とキューイング
   - メッセージ受信時に音声再生状態をチェック
   - 必要に応じてキューに追加
   - キューからの自動処理

3. **`idle-talk.ts`** - Idle Talkの音声再生チェック
   - タイムアウト時に音声再生状態を確認
   - 再生中ならタイマーを延期

## 動作フロー

### 通常時（音声再生していない）

```
YouTubeコメント受信
  ↓
nowSpeaking=false を確認
  ↓
即座にLLM応答生成 → TTS再生
```

### 音声再生中

```
YouTubeコメント受信
  ↓
nowSpeaking=true を確認
  ↓
メッセージをキューに追加
  ↓
（現在の音声再生が完了）
  ↓
watchSpeechEnd が発火
  ↓
キューから次のメッセージを取得
  ↓
LLM応答生成 → TTS再生
  ↓
（キューが空になるまで繰り返し）
```

## 使用方法

### 基本的な使い方

メッセージキューシステムは自動的に有効化されます。`VITE_AUTO_RESPONSE_ENABLED=true`が設定されていれば、特別な設定は不要です。

### ログの確認

ブラウザコンソールで以下のログを確認できます：

```javascript
// メッセージがキューに追加された場合
[WebSocket] Character is speaking or processing, queueing message
[MessageQueue] Message queued (2 in queue): text: "こんにちは！", author: "視聴者A"

// 音声再生終了後、キューから処理
[MessageQueue] Speech ended, checking queue...
[MessageQueue] Dequeued message (1 remaining): queuedDuration: 3542ms
[MessageQueue] Processing next queued message
```

### デバッグ

Console Logger機能を使ってログを保存・確認できます：

```javascript
// ブラウザコンソールで実行
window.exportLogsText()  // ログをテキストファイルでダウンロード
window.logStats()        // キューの統計情報を表示
```

## 技術詳細

### 状態管理

```typescript
// メッセージキューの状態
messageQueue: QueuedMessage[]  // キューイングされたメッセージ
isProcessing: boolean          // メッセージ処理中フラグ

// 音声再生状態（useSpeakingStoreから取得）
nowSpeaking: boolean          // 音声再生中フラグ
```

### キューイング判定

メッセージは以下の条件でキューに追加されます：

```typescript
function shouldQueue(): boolean {
  const speaking = speakingStore.nowSpeaking  // 音声再生中
  const processing = isProcessing.value       // メッセージ処理中

  return speaking || processing
}
```

### メッセージ処理の排他制御

複数のメッセージが同時に処理されないよう、`isProcessing`フラグで制御：

```typescript
// メッセージ処理開始
messageQueue.startProcessing()  // isProcessing = true
try {
  await processMessage(message)
} finally {
  messageQueue.endProcessing()  // isProcessing = false
}
```

## トラブルシューティング

### メッセージが処理されない

**原因**: 音声再生が終了したことを検知できていない可能性

**確認方法**:
```javascript
window.logStats()  // キューにメッセージが残っているか確認
```

**解決策**:
- ブラウザコンソールでエラーがないか確認
- `nowSpeaking`状態が正しく更新されているか確認

### メッセージの順序が入れ替わる

**原因**: このシステムはFIFO（先入れ先出し）を保証していますが、WebSocketの到着順序は保証されません

**解決策**: 通常は問題ありませんが、厳密な順序が必要な場合はタイムスタンプでソートする実装を追加

### キューが溜まりすぎる

**原因**: 処理速度よりも受信速度が速い場合

**確認方法**:
```javascript
// キューサイズを定期的に確認
setInterval(() => {
  console.info('[Queue Size]', messageQueue.value.length)
}, 5000)
```

**解決策**:
- LLM応答生成を高速化（より速いモデルを使用）
- TTS再生を高速化（より速い音声合成を使用）
- 必要に応じてキューサイズに上限を設定

## パフォーマンス

### メモリ使用量

- 各メッセージは数百バイト程度
- 通常のYouTube配信では問題なし
- 極端に大量のコメントがある場合、キューサイズ制限を検討

### レイテンシ

- キューイングによる遅延: ほぼゼロ（メモリ操作のみ）
- 処理待ち時間: 音声再生時間に依存（通常5-30秒）
- 複数メッセージがキューに溜まった場合、それぞれの処理時間が加算

## 関連ファイル

- `apps/stage-web/src/composables/useMessageQueue.ts` - キューシステム本体
- `apps/stage-web/src/composables/websocket-client.ts` - WebSocket統合
- `apps/stage-web/src/composables/idle-talk.ts` - Idle Talk統合
- `packages/stage-ui/src/stores/audio.ts` - 音声再生状態管理

## 参考資料

- [Console Logger Documentation](./CONSOLE-LOGGER.md)
- [Idle Talk Documentation](./.claude-notes/sessions/2025-10-17-idle-talk.md)
