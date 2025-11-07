# Shogi Analysis - 将棋棋譜解析・実況生成

将棋の棋譜（KIF/KI2/CSA形式）を解析し、実況コメントを生成するツールです。

## 機能

- ✅ KIF形式の棋譜解析
- ✅ KI2形式の棋譜解析
- ✅ CSA形式の棋譜解析
- ✅ テンプレートベース実況コメント生成
- ✅ **LLMベース実況コメント生成** (Phase 1.5 完了)
  - OpenRouter互換APIサポート（OpenAI、Anthropic、Google Geminiなど）
  - Markdownベースのプロンプト管理
  - 序盤・中盤・終盤に応じた解説
  - コメント間隔のカスタマイズ

## インストール

```bash
cd services/shogi-analysis
npm install
```

## 使用方法

### 環境変数の設定

LLMを使った実況生成を利用する場合、`.env`ファイルを作成してAPIキーを設定します：

```bash
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

```.env
LLM_PROVIDER=openrouter-ai
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://openrouter.ai/api/v1/
VITE_LLM_MODEL=google/gemini-2.0-flash-exp:free
```

### 基本的な使い方

```bash
# テンプレートベース実況（LLM不要）
npm run analyze data/sample-kifu/kifu-example.kif

# LLMベース実況（推奨）
tsx src/index.ts --llm data/sample-kifu/kifu-example.kif

# コメント間隔を指定（N手ごと）
tsx src/index.ts --llm --interval 5 data/sample-kifu/kifu-example.kif

# 詳細ログ付き
tsx src/index.ts --llm --verbose data/sample-kifu/kifu-example.kif
```

### コマンドラインオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--llm` | LLMを使って実況コメント生成 | テンプレートベース |
| `--interval <N>` | N手ごとにコメント生成 | 10 |
| `--verbose`, `-v` | 詳細なログを表示 | false |

### サンプル棋譜の入手

以下のサイトから棋譜ファイル（KIF形式）をダウンロードできます：

- [将棋タイトル戦](https://shogititle.nobody.jp/download.html)
- [Shogi DB2](https://shogidb2.com/)

ダウンロードした棋譜を `data/sample-kifu/` に配置してください。

## 対応フォーマット

| フォーマット | 拡張子 | 説明 |
|------------|--------|------|
| KIF | `.kif` | 柿木将棋形式（最も一般的） |
| KI2 | `.ki2` | 簡略記法 |
| CSA | `.csa` | コンピュータ将棋協会標準形式 |

## 出力例

### テンプレートベース

```text
=== 対局実況 ===

NHK杯、羽生善治先手、加藤一二三後手の対局（1989/01/09）が始まりました。

初手は七6歩です。

10手目、後手は七7角成と指しました。序盤の駆け引きが続きます。

まで68手で対局終了です。お疲れ様でした。
```

### LLMベース

```text
=== 対局実況 ===

さあ、いよいよ始まりました！NHK杯、注目の対局です！
本日は、先手・羽生善治さん、そして後手には「ひふみん」の愛称でおなじみ、
加藤一二三さんが登場です！若き天才とベテラン棋士の激突、どんな将棋になるのか、
今からワクワクしますね！

【1手目】先手：七6歩
はい、皆さんこんにちは！将棋実況のしょうぎんです！
先手番の初手は「七六歩」ですね！これは、将棋の駒組みにおいて最もポピュラーな一手です。
飛車先の歩を突いて、自陣を固めつつ、攻めの足がかりを築こうという意図が見て取れます。

【15手目】先手：三8銀
おっと、先手は15手目、▲3八銀と上がってきましたね。これは、これから銀をどう活用していくか、
先手の駒組みの意図が垣間見える一手と言えるでしょう。
```

## プロンプトのカスタマイズ

LLM実況のプロンプトは`prompts/`ディレクトリのMarkdownファイルで管理されています：

- `prompts/system.md` - システムプロンプト（役割定義、スタイルガイド）
- `prompts/opening.md` - 対局開始コメント
- `prompts/move.md` - 指し手コメント
- `prompts/closing.md` - 対局終了コメント

詳細は[prompts/README.md](prompts/README.md)を参照してください。

### プロンプト編集例

```bash
# システムプロンプトを編集
vim prompts/system.md

# 口調を変更
# 「明るく親しみやすい口調」→「プロフェッショナルな解説口調」

# テスト
tsx src/index.ts --llm data/sample-kifu/kifu-example.kif
```

## 開発

### テスト

ユニットテストを実行：

```bash
# テスト実行（watch mode）
npm test

# 1回だけ実行
npm run test:run
```

**テストカバレッジ**：

- 棋譜パーサー（KIF/KI2/CSA形式）
- 実況コメント生成
- 特殊な手（投了、中断など）の処理
- エラーハンドリング

**テストファイル**：

- `tests/core/kifu-parser.test.ts` - 棋譜解析のテスト
- `tests/commentary.test.ts` - 実況生成のテスト
- `tests/fixtures/` - テスト用サンプル棋譜

### 型チェック

```bash
npm run typecheck
```

### デバッグモード

```bash
# 環境変数でログレベルを設定
LOG_LEVEL=debug npm run analyze data/sample-kifu/example1.kif
```

## アーキテクチャ

```text
services/shogi-analysis/
├── data/sample-kifu/        # サンプル棋譜ファイル
├── prompts/                 # LLMプロンプトテンプレート
│   ├── system.md           # システムプロンプト
│   ├── opening.md          # 対局開始プロンプト
│   ├── move.md             # 指し手プロンプト
│   └── closing.md          # 対局終了プロンプト
├── src/
│   ├── core/
│   │   └── kifu-parser.ts  # 棋譜パーサー（KIF/KI2/CSA）
│   ├── config.ts           # 環境変数ローダー
│   ├── llm-client.ts       # LLMクライアント（OpenAI互換）
│   ├── llm-commentary.ts   # LLM実況生成
│   ├── prompt-loader.ts    # プロンプトローダー
│   ├── commentary.ts       # テンプレート実況生成
│   └── index.ts            # CLIエントリーポイント
└── tests/                   # テストスイート
```

## 実装フェーズ

- ✅ **Phase 1**: 棋譜解析モジュール（完了）
- ✅ **Phase 1.5**: LLM実況生成（完了）
- 📋 **Phase 2**: AIRI Server統合（TTS音声化）
- 📋 **Phase 3**: リアルタイム棋譜取得
- 📋 **Phase 4**: stage-web UI統合
- 📋 **Phase 5**: AI評価値統合、詳細解説

## ライセンス

MIT

## 参考資料

- [json-kifu-format](https://github.com/na2hiro/json-kifu-format)
- [Kifu-for-JS](https://github.com/na2hiro/Kifu-for-JS)
