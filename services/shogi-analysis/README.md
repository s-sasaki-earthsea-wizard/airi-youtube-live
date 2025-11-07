# Shogi Analysis - 将棋棋譜解析・実況生成

将棋の棋譜（KIF/KI2/CSA形式）を解析し、実況コメントを生成するツールです。

## 機能

- ✅ KIF形式の棋譜解析
- ✅ KI2形式の棋譜解析
- ✅ CSA形式の棋譜解析
- ✅ 基本的な実況コメント生成
- 📋 LLMベースの詳細実況（Phase 2で実装予定）

## インストール

```bash
cd services/shogi-analysis
npm install
```

## 使用方法

### 基本的な使い方

```bash
# 棋譜ファイルを解析
npm run analyze data/sample-kifu/example1.kif

# または
tsx src/index.ts data/sample-kifu/example1.kif
```

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

```text
=== 対局実況 ===

竜王戦、藤井聡太先手、羽生善治後手の対局が始まりました。

初手は７六歩です。

10手目、後手、３四歩。

20手目、先手、２六歩。

まで127手で対局終了です。
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

## 今後の拡張予定

- Phase 2: AIRI Server統合（TTS音声化）
- Phase 3: リアルタイム棋譜取得
- Phase 4: stage-web UI統合
- Phase 5: LLMベース詳細実況、AI評価値統合

## ライセンス

MIT

## 参考資料

- [json-kifu-format](https://github.com/na2hiro/json-kifu-format)
- [Kifu-for-JS](https://github.com/na2hiro/Kifu-for-JS)
