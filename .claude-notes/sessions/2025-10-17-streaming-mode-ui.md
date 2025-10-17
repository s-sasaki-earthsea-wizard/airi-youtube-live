# 2025-10-17: YouTube Streaming Mode UI

## 概要

YouTube Live配信向けにstage-webのUIをカスタマイズする機能を実装。環境変数でヘッダー、LLMレスポンス、テキスト入力の表示/非表示を制御可能にした。

## ブランチ

- `feat/youtube-streaming-mode` - YouTube配信向けUI機能の実装

## 実装内容

### 1. ストリーミングモード基盤 (コミット: 6a7dfad5)

**実装した機能:**
- `streaming-mode.ts` composableの作成
- 環境変数ベースの設定管理
- ヘッダー表示/非表示機能
- LLMレスポンス表示/非表示機能

**ファイル:**
- `apps/stage-web/src/composables/streaming-mode.ts` (新規作成)
- `apps/stage-web/src/pages/index.vue` (ヘッダー制御追加)
- `apps/stage-web/src/components/Widgets/ChatHistory.vue` (LLMレスポンス制御)
- `apps/stage-web/.env.example` (環境変数追加)

**環境変数:**
```env
VITE_STREAMING_MODE=false
VITE_SHOW_HEADER=true
VITE_SHOW_LLM_RESPONSES=true
```

**技術的課題と解決:**
- **課題1**: ヘッダー非表示時に3Dキャラクターが表示されない
  - **原因**: レイアウトの崩れ
  - **解決**: `pt-3` paddingと`InteractiveArea`の高さを動的に調整

- **課題2**: Vue warn - UnoCSS属性の使用法エラー
  - **原因**: UnoCSS属性は静的値または`:class`バインディングが必要
  - **解決**: `:h`を`:class`に変更

- **課題3**: Computed refの複雑性
  - **原因**: `useStreamingMode()`がcomputedを返していた
  - **解決**: プレーンオブジェクトを返すように変更

### 2. YouTubeユーザー名表示 (コミット: 1999364b)

**実装した機能:**
- チャット履歴でYouTubeユーザー名を動的に表示
- ユーザー名がない場合は完全に空欄

**ファイル:**
- `packages/stage-ui/src/types/chat.ts` (`ChatUserMessage`に`author`と`source`追加)
- `apps/stage-web/src/composables/websocket-client.ts` (author情報の保存)
- `apps/stage-web/src/components/Widgets/ChatHistory.vue` (ユーザー名表示)

**データフロー:**
```
YouTube Bot → WebSocket → websocket-client.ts → ChatStore → ChatHistory.vue
              (author付き)    (author保存)      (messages)   (表示)
```

### 3. ロゴとスタイル改善 (コミット: 6d2c48c1)

**実装した機能:**
- ライセンス表記にロゴ追加
- ダーク/ライトモード対応のロゴ切り替え
- 淡い青色を基調とした視認性の高いスタイリング

**ファイル:**
- `apps/stage-web/src/components/LicenseNotice.vue`

**スタイル:**
```css
background: rgba(59, 130, 246, 0.25);
color: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(10px);
text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
```

**ロゴ:**
- ライトモード: `/src/assets/logo.svg`
- ダークモード: `/src/assets/logo-dark.svg`
- サイズ: 44x44px (デスクトップ), 20x20px (モバイル)

### 4. テキスト入力制御 (コミット: 498861a3)

**実装した機能:**
- テキスト入力エリアの表示/非表示制御
- デスクトップとモバイルの両方に対応

**ファイル:**
- `apps/stage-web/src/composables/streaming-mode.ts` (`showTextInput`追加)
- `apps/stage-web/src/components/Layouts/InteractiveArea.vue`
- `apps/stage-web/src/components/Layouts/MobileInteractiveArea.vue`
- `apps/stage-web/.env.example`

**環境変数:**
```env
VITE_SHOW_TEXT_INPUT=true
```

**使用例:**
- 配信時: `VITE_SHOW_TEXT_INPUT=false` (YouTubeチャットから入力)
- 開発時: `VITE_SHOW_TEXT_INPUT=true` (ローカルテスト用)

### 5. レイアウト修正 (コミット: 95f6417d)

**修正内容:**
- ヘッダー非表示時の画面上部の隙間を削除
- `pt-3` paddingを削除して完全な全画面表示を実現

**ファイル:**
- `apps/stage-web/src/pages/index.vue`

**修正前:**
```vue
<div :class="{ 'pt-3': !streamingMode.showHeader }">
```

**修正後:**
```vue
<div>
```

## コミット履歴

1. `6a7dfad5` - feat(stage-web): add YouTube streaming mode with UI toggles
2. `1999364b` - feat(stage-web): add dynamic YouTube username display in chat
3. `6d2c48c1` - style(stage-web): enhance license notice with logo and improved visibility
4. `498861a3` - feat(stage-web): add text input toggle for streaming mode
5. `95f6417d` - fix(stage-web): remove top padding when header is hidden

## 使用方法

### YouTube配信用設定

```env
VITE_STREAMING_MODE=true
VITE_SHOW_HEADER=false
VITE_SHOW_LLM_RESPONSES=false
VITE_SHOW_TEXT_INPUT=false
```

**効果:**
- ヘッダー非表示 (ロゴ、設定ボタン)
- チャットにユーザーメッセージのみ表示
- LLMレスポンスは音声のみ (TTS)
- テキスト入力欄非表示 (YouTubeチャットから入力)
- 画面全体をキャラクターとチャットに使用

### ローカル開発用設定

```env
VITE_STREAMING_MODE=false
VITE_SHOW_HEADER=true
VITE_SHOW_LLM_RESPONSES=true
VITE_SHOW_TEXT_INPUT=true
```

**効果:**
- 全UI要素が表示される
- ローカルでテキスト入力可能
- LLMレスポンスをチャットで確認可能

## アーキテクチャ

### Composable: streaming-mode.ts

```typescript
export interface StreamingModeConfig {
  isStreamingMode: boolean
  showHeader: boolean
  showLLMResponses: boolean
  showTextInput: boolean
}

export function useStreamingMode(): StreamingModeConfig {
  const streamingMode = import.meta.env.VITE_STREAMING_MODE === 'true'

  return {
    isStreamingMode: streamingMode,
    showHeader: streamingMode
      ? import.meta.env.VITE_SHOW_HEADER === 'true'
      : import.meta.env.VITE_SHOW_HEADER !== 'false',
    showLLMResponses: streamingMode
      ? import.meta.env.VITE_SHOW_LLM_RESPONSES === 'true'
      : import.meta.env.VITE_SHOW_LLM_RESPONSES !== 'false',
    showTextInput: streamingMode
      ? import.meta.env.VITE_SHOW_TEXT_INPUT === 'true'
      : import.meta.env.VITE_SHOW_TEXT_INPUT !== 'false',
  }
}
```

**設計の意図:**
- ストリーミングモードがfalseの場合、各設定のデフォルトはtrue (通常モード)
- ストリーミングモードがtrueの場合、各設定のデフォルトはfalse (配信最適化)
- 個別の環境変数で細かい調整が可能

### コンポーネント構造

```
index.vue (ページレベル)
├── Header / MobileHeader (v-if="streamingMode.showHeader")
├── WidgetStage (3Dキャラクター表示)
└── InteractiveArea / MobileInteractiveArea
    ├── ChatHistory
    │   ├── User messages (常に表示、author名付き)
    │   └── Assistant messages (v-if="streamingMode.showLLMResponses")
    └── BasicTextarea (v-if="streamingMode.showTextInput")
```

## 技術的な学び

### Vue 3 + UnoCSS

1. **UnoCSS属性の使い方**
   - 動的な値は`:class`バインディングを使う
   - `:h="value"`は使えない、`:class="h-[value]"`を使う

2. **Composableのベストプラクティス**
   - シンプルなオブジェクトを返す方が使いやすい
   - `computed()`で包む必要がない場合は避ける
   - `.value`アクセスが不要になり、コードが簡潔に

3. **条件付きレンダリング**
   - `v-if`で完全に削除するか、`:class`で非表示にするか
   - 今回は`v-if`を選択 (DOM要素自体を削除)

### 環境変数の設計

1. **デフォルト値のロジック**
   ```typescript
   // 'true'の場合のみtrue、それ以外はfalse
   streamingMode ? env === 'true' : env !== 'false'
   ```

2. **フォールバック戦略**
   - ストリーミングモードOFF: 明示的にfalseでない限りtrue
   - ストリーミングモードON: 明示的にtrueの場合のみtrue

## ドキュメント更新

- `README.md` - YouTube Streaming Mode機能の追加を記載
- `apps/stage-web/README.md` - 詳細な設定ガイドを追加
- `CLAUDE.md` - セッション履歴を更新

## 次のステップ (未実装)

今回のブランチでは実装しなかったが、将来的に検討する項目:

1. **UIトグル機能** - 当初提案されたが、環境変数で十分と判断
2. **チャット履歴の永続化** - 配信中の履歴保存
3. **視聴者統計の表示** - チャット参加者数など
4. **モデレーション機能** - 不適切なコメントのフィルタリング

## 参考資料

- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [UnoCSS Attributify Mode](https://unocss.dev/presets/attributify)
- [@vueuse/core useDark](https://vueuse.org/core/useDark/)
- [Project AIRI Repository](https://github.com/moeru-ai/airi)

---

**作業時間**: 約2時間
**コミット数**: 5
**変更ファイル数**: 11
