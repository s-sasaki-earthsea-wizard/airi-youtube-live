# Console Logger

ブラウザのコンソールログをキャプチャして、Claude Codeとの共有を簡単にするための機能です。

## 機能

- すべての `console.log/info/warn/error` を自動的にキャプチャ
- localStorageに最新200件のログを保存
- ブラウザコンソールから簡単にエクスポート可能
- JSON形式またはテキスト形式でダウンロード

## 使い方

### 1. ログの確認

開発モード（`pnpm dev`）で起動すると、自動的にログキャプチャが有効になります。

ブラウザコンソールに以下のメッセージが表示されます：

```
[ConsoleLogger] Setup complete. Available commands:
  - window.exportLogs()      : Download logs as JSON
  - window.exportLogsText()  : Download logs as text
  - window.clearLogs()       : Clear all logs
  - window.logStats()        : Show log statistics
```

### 2. ログのエクスポート

#### JSON形式でエクスポート

```javascript
window.exportLogs()
```

ダウンロードされるファイル例：
```json
[
  {
    "timestamp": "2025-10-20T01:23:45.678Z",
    "level": "INFO",
    "message": "[WebSocket] Received input:text event",
    "data": ["[WebSocket] Received input:text event", { "text": "...", "author": "..." }]
  },
  ...
]
```

#### テキスト形式でエクスポート

```javascript
window.exportLogsText()
```

ダウンロードされるファイル例：
```
[2025-10-20T01:23:45.678Z] [INFO] [WebSocket] Received input:text event
[2025-10-20T01:23:46.789Z] [LOG] [AIRI] Initializing WebSocket client...
...
```

### 3. ログの統計確認

```javascript
window.logStats()
```

出力例：
```javascript
{
  total: 125,
  LOG: 45,
  INFO: 67,
  WARN: 10,
  ERROR: 3,
  oldestLog: "2025-10-20T01:00:00.000Z",
  newestLog: "2025-10-20T01:30:00.000Z"
}
```

### 4. ログのクリア

```javascript
window.clearLogs()
```

## Claude Codeとの共有方法

1. **問題が発生した時**に、ブラウザコンソールで以下を実行：
   ```javascript
   window.exportLogsText()  // または window.exportLogs()
   ```

2. ダウンロードされたファイルをClaude Codeと共有：
   ```
   User: "エラーが発生しました。ログファイルを確認してください。"
   [ファイルをアップロードまたは内容を貼り付け]
   ```

3. Claude Codeがログを分析して、問題を特定します。

## WebSocketデバッグの例

YouTubeコメント統合のデバッグで特に有用：

```javascript
// WebSocket接続の確認
window.logStats()  // INFO と LOG の数を確認

// ログをエクスポート
window.exportLogsText()

// ダウンロードしたファイルから以下を確認：
// - [WebSocket] Connected
// - [WebSocket] Auto-response mode: enabled
// - [WebSocket] Received input:text event  <- これが重要！
```

## 技術詳細

### ログ保存

- **保存先**: `localStorage` (key: `airi-console-logs`)
- **最大保存数**: 200エントリ
- **古いログ**: 自動的に削除（FIFO）

### 開発モードのみ

本番環境ではログキャプチャは無効化されます：

```typescript
// main.ts
if (import.meta.env.DEV) {
  setupConsoleLogger()  // 開発時のみ
}
```

### TypeScript型定義

グローバル関数は型安全：

```typescript
// TypeScript環境で自動補完が効く
window.exportLogs()      // ✓ 型チェックOK
window.exportLogsText()  // ✓ 型チェックOK
window.clearLogs()       // ✓ 型チェックOK
window.logStats()        // ✓ 型チェックOK
```

## トラブルシューティング

### ログが保存されない

- localStorageの容量制限に達している可能性があります
- `window.clearLogs()`で古いログをクリアしてください

### エクスポートボタンが反応しない

- ブラウザのポップアップブロッカーを確認してください
- 開発者コンソールでエラーメッセージを確認してください

### ログが多すぎる

- 最新200件のみ保存されます
- 必要に応じて定期的に`window.clearLogs()`でクリアしてください

## 関連ファイル

- `apps/stage-web/src/utils/console-logger.ts` - ロガー本体
- `apps/stage-web/src/types/console-logger.d.ts` - 型定義
- `apps/stage-web/src/main.ts` - セットアップ
