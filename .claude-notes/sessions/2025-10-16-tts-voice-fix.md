# TTS Voice Configuration Fix - 2025-10-16

## 概要

環境変数からTTS設定を読み込む機能を実装後、LLM応答は生成されるがTTS音声が再生されない問題が発生。根本原因を特定し、修正を完了。

## 問題の詳細

### 症状
- LLM応答は正常に生成される
- TTS音声が再生されない
- コンソールログに `Active voice: undefined` エラーが繰り返し表示される

### 根本原因

`packages/stage-ui/src/stores/modules/speech.ts:119-125` に存在するreactive watcherが原因：

```typescript
watch(activeSpeechVoiceId, (voiceId) => {
  if (voiceId) {
    activeSpeechVoice.value = availableVoices.value[activeSpeechProvider.value]?.find(voice => voice.id === voiceId)
  }
}, {
  immediate: true,
})
```

**問題点**:
1. `App.vue` で `activeSpeechVoice` を直接設定
2. このwatcherが `immediate: true` で即座に実行される
3. watcherは `availableVoices` 配列から音声を検索
4. 配列が空（APIから音声リストを取得していない）のため、`.find()` が `undefined` を返す
5. 設定した音声オブジェクトが `undefined` に上書きされる

## 解決策

`apps/stage-web/src/App.vue` の音声設定方法を変更：

**変更前**:
```typescript
// 直接 activeSpeechVoice を設定（watcherに上書きされる）
speechStore.activeSpeechVoice = {
  id: ttsVoiceId,
  name: 'Environment Voice',
}
```

**変更後**:
```typescript
const voiceObject = {
  id: ttsVoiceId,
  name: 'Environment Voice',
}

// availableVoices配列に音声を追加
if (!speechStore.availableVoices[ttsProvider]) {
  speechStore.availableVoices[ttsProvider] = []
}
speechStore.availableVoices[ttsProvider].push(voiceObject)

// voice IDを設定（watcherが配列から音声を見つける）
speechStore.activeSpeechVoiceId = ttsVoiceId
```

## 診断プロセス

1. `Stage.vue:112-171` に包括的なデバッグログを追加
2. ユーザーがコンソール出力を提供
3. `Active voice: undefined` が問題であることを確認
4. `App.vue` で正しく設定されているのに `undefined` になる理由を調査
5. `speech.ts` のreactive watcherが原因であることを特定
6. `availableVoices` 配列に音声を追加する方式に変更

## 修正ファイル

### apps/stage-web/src/App.vue:104-120
- 音声オブジェクトを `availableVoices` 配列に追加
- `activeSpeechVoiceId` を設定（watcherが配列から自動検索）
- デバッグログを削除

### packages/stage-ui/src/components/scenes/Stage.vue:112-148
- 追加したデバッグログを削除
- 元のクリーンなコードに戻す

## 結果

- TTS音声が正常に再生されるようになった
- `Active voice: undefined` エラーが解消
- 環境変数からの設定が完全に動作

## 技術的洞察

### Pinia Reactive Watchers
- Vue 3の reactive system により、store の値が変更されると watcher が自動実行される
- `immediate: true` オプションは、watcher を即座に実行する
- 複数の方法で同じ状態を設定する場合、watcher の動作を考慮する必要がある

### 環境変数の読み込み順序
1. Vite環境変数 (`import.meta.env.*`) を読み込み
2. Provider設定を更新
3. Store の状態を設定
4. **重要**: Reactive watcher の依存関係（`availableVoices`）を満たしてから state を更新

## 関連コミット

- `fix(stage-web): resolve TTS voice undefined issue in environment config` - TTS音声設定の修正とデバッグログ削除

## 参考資料

- [Vue 3 Reactivity API - watch](https://vuejs.org/api/reactivity-core.html#watch)
- [Pinia - State](https://pinia.vuejs.org/core-concepts/state.html)
- [Vite - Env Variables](https://vitejs.dev/guide/env-and-mode.html)
