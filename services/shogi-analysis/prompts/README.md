# Shogi Commentary Prompts

このディレクトリには、LLMを使った将棋実況コメント生成のためのプロンプトテンプレートが格納されています。

## プロンプトファイル

### [system.md](./system.md)
システムプロンプト。すべてのLLMリクエストに含まれます。

- 実況解説者としての役割定義
- コメントスタイルのガイドライン
- 注意事項

### [opening.md](./opening.md)
対局開始時のコメント生成用プロンプト。

**変数:**
- `{{GAME_INFO}}` - 棋戦名、対局者、対局日などの情報

### [move.md](./move.md)
各手のコメント生成用プロンプト。

**変数:**
- `{{MOVE_NUMBER}}` - 手数
- `{{PHASE}}` - フェーズ（序盤/中盤/終盤）
- `{{PLAYER}}` - 手番（先手/後手）
- `{{MOVE}}` - 指し手（例: ７六歩）
- `{{COMMENT}}` - 棋譜に含まれるコメント（任意）
- `{{PHASE_HINT}}` - フェーズごとのヒント

### [closing.md](./closing.md)
対局終了時のコメント生成用プロンプト。

**変数:**
- `{{TOTAL_MOVES}}` - 総手数
- `{{LAST_PLAYER}}` - 最終手の手番
- `{{LAST_MOVE}}` - 最終手

## プロンプトの編集

プロンプトを改善する際は：

1. このMarkdownファイルを直接編集
2. `{{変数名}}`形式で動的な値を埋め込む
3. システムプロンプトは簡潔に（トークン数制限に注意）
4. 実際の棋譜でテストして品質を確認

## 使用方法

プロンプトは `src/prompt-loader.ts` によって自動的に読み込まれます。

```typescript
import { getCachedPrompt, fillPromptTemplate } from './prompt-loader'

// プロンプトの読み込み（キャッシュされる）
const systemPrompt = getCachedPrompt('system')
const openingTemplate = getCachedPrompt('opening')

// 変数の埋め込み
const filledPrompt = fillPromptTemplate(openingTemplate, {
  GAME_INFO: '棋戦：竜王戦\n対局者：先手 藤井聡太、後手 羽生善治',
})
```

## プロンプトチューニングのヒント

### コメントの長さ調整
`system.md`の「1手につき2-3文程度」を変更してコメントの長さを調整できます。

### 口調の変更
`system.md`の「明るく親しみやすい口調」を変更して、フォーマルや専門的な口調に変更できます。

### フェーズごとのカスタマイズ
`move.md`のフェーズヒントを編集して、序盤・中盤・終盤での視点を調整できます。

## 今後の拡張案

- **棋風別プロンプト**: 振り飛車党、居飛車党など戦型に応じたプロンプト
- **難易度別プロンプト**: 初心者向け、上級者向けなど
- **言語別プロンプト**: 英語、中国語などの多言語対応
- **スタイル別プロンプト**: カジュアル、プロフェッショナル、ユーモラスなど
