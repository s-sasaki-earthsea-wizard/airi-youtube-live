# 2025-10-19: Environment Variable Priority Fix

## セッション概要

LocalStorageにキャッシュされた設定値が環境変数よりも優先されてしまい、`.env`ファイルの設定が反映されない問題を修正しました。これにより環境の再現性が確保されました。

## 問題の背景

前回のセッション（2025-10-18）で、YouTube API quotaの過剰消費問題とMakefileの修正を行いましたが、その際に以下の問題が発見されました：

1. **LLMモデル設定が環境変数から読み込まれない**
   - `consciousness.ts`のストアがデフォルト値として空文字列を使用
   - LocalStorageに古い値がキャッシュされていると、環境変数が無視される
   - OpenRouter APIから400エラーが返される

2. **TTS音声設定が環境変数から読み込まれない**
   - `speech.ts`のストアがデフォルト値として空文字列を使用
   - "No active speech voice configured"エラーが発生
   - LocalStorageの`settings/speech/voice`が空のまま

3. **VRMモデルの位置・スケール設定が環境変数から読み込まれない**
   - `model-store.ts`のストアがデフォルト値として`0`や`{ x: 0, y: 0, z: 0 }`を使用
   - 配信用のアバター位置調整が環境変数で制御できない

## 根本原因

VueUseの`useLocalStorage`は以下の優先順位で値を決定します：

1. LocalStorageに既存の値がある → その値を使用
2. LocalStorageに値がない → デフォルト値を使用してLocalStorageに保存

各ストアが環境変数ではなく固定値（空文字列や0）をデフォルト値としていたため、一度LocalStorageに値が保存されると、それ以降は`.env`の変更が反映されませんでした。

さらに、`App.vue`で`localStorage.setItem`を実行してもストアの初期化タイミングによっては上書きされてしまう問題もありました。

## 修正内容

### 1. `packages/stage-ui/src/stores/modules/consciousness.ts`

LLMプロバイダーとモデルの設定を環境変数から読み込むように変更：

```typescript
// Before
const activeProvider = useLocalStorage('settings/consciousness/active-provider', '')
const activeModel = useLocalStorage('settings/consciousness/active-model', '')

// After
const activeProvider = useLocalStorage('settings/consciousness/active-provider', import.meta.env.VITE_LLM_PROVIDER || '')
const activeModel = useLocalStorage('settings/consciousness/active-model', import.meta.env.VITE_LLM_MODEL || '')
```

**影響範囲**: `settings/consciousness/active-provider`, `settings/consciousness/active-model`

### 2. `packages/stage-ui/src/stores/modules/speech.ts`

TTSプロバイダー、モデル、ボイスIDを環境変数から読み込むように変更：

```typescript
// Before
const activeSpeechProvider = useLocalStorage('settings/speech/active-provider', '')
const activeSpeechModel = useLocalStorage('settings/speech/active-model', 'eleven_multilingual_v2')
const activeSpeechVoiceId = useLocalStorage<string>('settings/speech/voice', '')

// After
const activeSpeechProvider = useLocalStorage('settings/speech/active-provider', import.meta.env.VITE_TTS_PROVIDER || '')
const activeSpeechModel = useLocalStorage('settings/speech/active-model', import.meta.env.VITE_TTS_MODEL || 'eleven_multilingual_v2')
const activeSpeechVoiceId = useLocalStorage<string>('settings/speech/voice', import.meta.env.VITE_TTS_VOICE_ID || '')
```

**影響範囲**: `settings/speech/active-provider`, `settings/speech/active-model`, `settings/speech/voice`

### 3. `packages/stage-ui-three/src/stores/model-store.ts`

VRMモデルの位置とスケールを環境変数から読み込むように変更：

```typescript
// Before
const scale = useLocalStorage('settings/stage-ui-three/scale', 1)
const modelOffset = useLocalStorage('settings/stage-ui-three/modelOffset', { x: 0, y: 0, z: 0 })

// After
const scale = useLocalStorage('settings/stage-ui-three/scale', Number(import.meta.env.VITE_AVATAR_SCALE) || 1)
const modelOffset = useLocalStorage('settings/stage-ui-three/modelOffset', {
  x: Number(import.meta.env.VITE_AVATAR_POSITION_X) || 0,
  y: Number(import.meta.env.VITE_AVATAR_POSITION_Y) || 0,
  z: 0,
})
```

**影響範囲**: `settings/stage-ui-three/scale`, `settings/stage-ui-three/modelOffset`

**注**: Live2Dモデル用の`settings/live2d/position`と`settings/live2d/scale`は環境変数を使わない設計のため、デフォルト値に戻しました。

### 4. `packages/stage-ui/src/stores/live2d.ts`

Live2Dモデルの位置とスケールは環境変数を使わないように戻しました：

```typescript
// Changed back to fixed defaults
const position = useLocalStorage('settings/live2d/position', { x: 0, y: 0 })
const scale = useLocalStorage('settings/live2d/scale', 1)
```

**理由**: VRMモデルのみ環境変数で制御し、Live2Dモデルは従来通りUI設定で管理する方針。

## 動作確認方法

### LocalStorageのクリアが必要な場合

既存のLocalStorage値がある環境では、以下の手順でクリアが必要です：

1. ブラウザの開発者ツールを開く（F12）
2. Application → Local Storage → `http://localhost:5173` を選択
3. 以下のキーを削除：
   - `settings/consciousness/active-provider`
   - `settings/consciousness/active-model`
   - `settings/speech/active-provider`
   - `settings/speech/active-model`
   - `settings/speech/voice`
   - `settings/stage-ui-three/scale`
   - `settings/stage-ui-three/modelOffset`
4. ページをリロード（Cmd+Shift+R）

### 新規環境での動作

新規環境では`.env`ファイルの設定がそのまま適用されます：

```bash
# .env example
VITE_LLM_PROVIDER=openrouter-ai
VITE_LLM_MODEL=google/gemini-2.5-flash-lite
VITE_TTS_PROVIDER=elevenlabs
VITE_TTS_MODEL=eleven_v3
VITE_TTS_VOICE_ID=lhTvHflPVOqgSWyuWQry
VITE_AVATAR_MODEL=preset-vrm-2
VITE_AVATAR_POSITION_X=0.1
VITE_AVATAR_POSITION_Y=-0.2
VITE_AVATAR_SCALE=1
```

## 環境変数のマッピング

| 環境変数 | LocalStorageキー | 対象 |
|---------|-----------------|------|
| `VITE_LLM_PROVIDER` | `settings/consciousness/active-provider` | LLMプロバイダー |
| `VITE_LLM_MODEL` | `settings/consciousness/active-model` | LLMモデル |
| `VITE_TTS_PROVIDER` | `settings/speech/active-provider` | TTSプロバイダー |
| `VITE_TTS_MODEL` | `settings/speech/active-model` | TTSモデル |
| `VITE_TTS_VOICE_ID` | `settings/speech/voice` | TTS音声ID |
| `VITE_AVATAR_MODEL` | `settings/stage/model` | アバターモデル（既存） |
| `VITE_AVATAR_POSITION_X` | `settings/stage-ui-three/modelOffset.x` | VRMモデルX位置 |
| `VITE_AVATAR_POSITION_Y` | `settings/stage-ui-three/modelOffset.y` | VRMモデルY位置 |
| `VITE_AVATAR_SCALE` | `settings/stage-ui-three/scale` | VRMモデルスケール |

## 期待される効果

1. **環境の再現性向上**
   - `.env`ファイルのみで全ての初期設定を管理可能
   - チームメンバー間での設定共有が容易
   - OBS配信環境のセットアップが簡略化

2. **デバッグの効率化**
   - LocalStorageの古い値に悩まされることがなくなる
   - 環境変数を変更すればLocalStorageクリア後に即反映

3. **配信準備の自動化**
   - アバターの位置・スケールを`.env`で事前設定
   - 配信開始時に手動調整不要

## トラブルシューティング

### 環境変数が反映されない場合

1. **LocalStorageをクリア**: 上記「動作確認方法」を参照
2. **Viteの再起動**: 環境変数の変更後は`make stream`を再実行
3. **ブラウザのハードリフレッシュ**: Cmd+Shift+R（macOS）またはCtrl+Shift+R（Windows/Linux）

### OpenRouter API 400エラーが続く場合

```bash
# LocalStorageの該当キーを完全削除
localStorage.removeItem('settings/consciousness/active-provider')
localStorage.removeItem('settings/consciousness/active-model')
localStorage.removeItem('settings/consciousness/active-custom-model')
```

### TTS音声が設定されない場合

```bash
# LocalStorageの該当キーを完全削除
localStorage.removeItem('settings/speech/voice')
localStorage.removeItem('settings/speech/active-provider')
localStorage.removeItem('settings/speech/active-model')
```

## 関連する過去のセッション

- [2025-10-18: YouTube Live Test](./.claude-notes/sessions/2025-10-18-youtube-live-test.md) - YouTube API quota問題とMakefile修正
- [2025-10-18: Avatar Environment Configuration](./.claude-notes/sessions/2025-10-18-avatar-env-config.md) - アバター環境変数の初回実装

## 技術的詳細

### useLocalStorageの動作

VueUseの`useLocalStorage`は、第2引数のデフォルト値を以下のように扱います：

1. LocalStorageに既存の値がある場合 → 既存の値を返す
2. LocalStorageに値がない場合 → デフォルト値をLocalStorageに保存して返す

この仕様により、ストア定義時にデフォルト値として環境変数を渡すことで、初回起動時に環境変数の値がLocalStorageに保存されます。

### App.vueとストア定義の関係

当初、`App.vue`の`onMounted`で`localStorage.setItem`を実行していましたが、以下の理由で不十分でした：

1. ストアの初期化タイミングが不定
2. ストアが先に初期化されると空のデフォルト値でLocalStorageが上書きされる
3. `App.vue`での設定が無効化される

**解決策**: ストア定義自体で環境変数をデフォルト値として使用することで、初期化順序に依存しない設計に変更しました。

## まとめ

今回の修正により、`.env`ファイルが唯一の信頼できる設定ソース（Single Source of Truth）として機能するようになりました。LocalStorageはあくまでキャッシュとして動作し、初回起動時は必ず環境変数から値が読み込まれます。

これにより、以下のワークフローが実現できます：

```bash
# 1. .envを編集
vim apps/stage-web/.env

# 2. LocalStorageをクリア（既存環境の場合のみ）
# ブラウザ開発者ツールで該当キーを削除

# 3. アプリケーション起動
make stream

# 4. 環境変数の設定が自動的に反映される
```

---

**日付**: 2025-10-19
**担当**: Claude Code (Sonnet 4.5)
**ステータス**: 完了
