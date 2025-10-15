# セッション履歴: YouTube Live Chat Integration

**日付**: 2025-10-10
**ブランチ**: `feat/youtube-live-chat-integration`
**目的**: YouTube Live配信機能を統合し、視聴者とのリアルタイムインタラクションを可能にする

## 完了したタスク

### 1. ✅ プロジェクト調査
- 既存のBot実装（Discord、Telegram）を分析
- プロジェクト構造と規約を確認
- 統合パターンと依存関係を特定

### 2. ✅ アーキテクチャ設計
- YouTube Live Chatポーリングシステムを設計
- OAuth 2.0認証フローを計画
- メッセージ処理とAI応答パイプラインを設計

### 3. ✅ 実装
- `services/youtube-bot/`に完全なYouTube Botサービスを作成
- OAuth 2.0認証を実装（`youtube/auth.ts`）
- YouTube APIクライアントラッパーを構築（`youtube/client.ts`）
- ライブチャットポーリング機構を開発（`youtube/live-chat-poller.ts`）
- LLMとTTS統合を持つメッセージハンドラーを作成（`handlers/message-handler.ts`）
- グレースフルシャットダウン付きメインエントリポイントを設定（`index.ts`）

### 4. ✅ 設定
- 適切な依存関係を持つ`package.json`を作成
- TypeScript設定（`tsconfig.json`）をセットアップ
- 環境変数テンプレート（`.env.example`）を提供
- TypeScript型を定義（`types.ts`）

### 5. ✅ ドキュメント
- youtube-botサービスの包括的なREADMEを作成
- プロジェクトドキュメントに統合ガイドを追加（`docs/content/en/docs/integrations/youtube-live-chat.md`）
- セットアップ手順、設定オプション、トラブルシューティングを文書化

## 作成されたファイル

```
services/youtube-bot/
├── package.json                     # 依存関係とスクリプト
├── tsconfig.json                    # TypeScript設定
├── .env.example                     # 環境変数テンプレート
├── README.md                        # サービス固有のドキュメント
└── src/
    ├── index.ts                     # メインエントリポイント
    ├── types.ts                     # TypeScript型定義
    ├── youtube/
    │   ├── auth.ts                  # OAuth 2.0認証
    │   ├── client.ts                # YouTube APIクライアントラッパー
    │   └── live-chat-poller.ts      # ライブチャットポーリングロジック
    └── handlers/
        └── message-handler.ts       # LLM/TTSを使ったメッセージ処理

docs/content/en/docs/integrations/
└── youtube-live-chat.md             # 統合ドキュメント
```

## 技術的決定

### YouTube APIアプローチ
- ポーリングベースのアプローチを使用（YouTubeはWebSocket APIを提供していない）
- 5秒のデフォルトポーリング間隔を実装（設定可能）
- 処理済みIDのSetを使用したメッセージ重複排除を追加
- YouTubeのAPIレスポンスから推奨される`pollingIntervalMillis`を尊重

### 認証
- 長時間実行セッションのためのリフレッシュトークン付きOAuth 2.0
- トークン生成のための個別認証スクリプト（`pnpm auth`）
- `.env`ファイルでの安全な認証情報保管

### メッセージ処理
- 既存の`@xsai/generate-text`パッケージ経由のLLM統合
- 既存の`@xsai/generate-speech`パッケージ経由のTTS統合
- 会話履歴管理（最大20メッセージ）
- 金額表示付きスーパーチャットの特別処理

### アーキテクチャパターン
- 既存のBotパターン（Discord/Telegram）に従う
- 関心の分離: Client → Poller → Handler
- 既存のロギングインフラストラクチャ（`@guiiai/logg`）を使用
- 一貫したエラーハンドリングとグレースフルシャットダウン

## API使用に関する考慮事項

- **クォータ**: YouTube Data API v3は1日10,000ユニットの制限
- **ポーリングあたりのコスト**: `liveChatMessages.list`呼び出しあたり約1ユニット
- **推定容量**: 5秒間隔で1日約10,000ポーリング
- **最適化**: YouTubeの推奨に基づいてポーリング間隔を調整

## 追加された依存関係

```json
{
  "googleapis": "^140.0.0",           // YouTube Data API v3クライアント
  "google-auth-library": "^9.0.0",   // OAuth 2.0認証
  "@xsai/generate-text": "catalog:", // LLM統合（既存）
  "@xsai/generate-speech": "catalog:", // TTS統合（既存）
  "@guiiai/logg": "catalog:",        // ロギング（既存）
  "@dotenvx/dotenvx": "^1.51.0"      // 環境変数管理
}
```

## 統合機能

- ✅ リアルタイムチャットモニタリング（2-5秒のレイテンシ）
- ✅ AI駆動の応答生成
- ✅ Text-to-Speechオーディオファイル作成
- ✅ スーパーチャット検出と特別処理
- ✅ 会話コンテキスト管理
- ✅ 自動メッセージ重複排除
- ✅ グレースフルなエラーハンドリングと回復
- ✅ OBS互換オーディオ出力

## 既知の制限

1. **ポーリング遅延**: ポーリングベースのアプローチによる2-10秒（YouTubeからWebSocket APIが利用不可）
2. **APIクォータ**: 1日10,000ユニットに制限（適切な間隔設定で管理可能）
3. **直接チャット投稿なし**: 現在の実装はオーディオのみ生成；チャット投稿はオプションで追加クォータが必要
4. **単一ストリーム**: Botは一度に1つのアクティブストリームに接続（複数ストリームには複数インスタンスを実行可能）

## テスト推奨事項

実装をテストするには：

1. Google Cloud ConsoleプロジェクトとOAuth認証情報をセットアップ
2. 認証フローを実行: `pnpm auth`
3. すべての必要な認証情報で`.env`を設定
4. YouTube ライブストリームを開始
5. Botを実行: `pnpm -F @proj-airi/youtube-bot start`
6. ライブチャットでテストメッセージを送信
7. `audio-output/`でオーディオファイルが生成されることを確認
8. スーパーチャット機能をテスト
9. 会話コンテキストが維持されることを確認
10. グレースフルシャットダウンをテスト（Ctrl+C）

## 環境設定

必要な環境変数：

```env
# YouTube OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=1//0xxx

# LLMプロバイダー
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-xxx

# TTSプロバイダー
TTS_PROVIDER=openai-audio-speech
TTS_MODEL=tts-1
TTS_VOICE=alloy
TTS_API_KEY=sk-xxx

# 設定
POLLING_INTERVAL_MS=5000
AUDIO_OUTPUT_DIR=./audio-output
LOG_LEVEL=info
```

## ドキュメント構造

```
docs/content/en/docs/integrations/youtube-live-chat.md
├── 概要
├── 前提条件
├── セットアップ手順
│   ├── 1. YouTube Data API v3を有効化
│   ├── 2. 環境変数を設定
│   ├── 3. Googleで認証
│   └── 4. 依存関係をインストール
├── Botの実行
├── OBS統合（3つの方法）
├── 設定オプション
├── 技術詳細
│   ├── アーキテクチャ図
│   └── API使用と制限
├── トラブルシューティング
├── 高度な使用方法
└── 開発情報
```

## 開発ワークフロー

### アプローチ

1. **調査フェーズ**
   - 既存の実装を読む
   - プロジェクト規約を理解する
   - 統合パターンを特定する

2. **計画フェーズ**
   - アーキテクチャを設計する
   - ファイル構造を計画する
   - インターフェースと型を定義する

3. **実装フェーズ**
   - 既存のパターンに従う
   - モジュラーでテスト可能なコードを書く
   - プロジェクトの既存ユーティリティを使用する

4. **ドキュメントフェーズ**
   - サービスのREADMEを作成する
   - ドキュメントに統合ガイドを追加する
   - セットアップとトラブルシューティングを文書化する

### コード品質基準

- **TypeScript**: 厳格な型チェックを有効化
- **エラーハンドリング**: ロギング付きの包括的なtry-catchブロック
- **ロギング**: `@guiiai/logg`の一貫した使用
- **設定**: 環境ベースの設定
- **コードスタイル**: 既存のESLint設定に従う

### 学んだ教訓

1. **パターン認識**: 既存のDiscord/Telegram Botが優れたテンプレートを提供
2. **段階的開発**: 論理的な順序で構築（auth → client → poller → handler）
3. **ドキュメント優先**: 明確なドキュメントの作成が設計の検証に役立つ
4. **API制限**: YouTubeのポーリングのみのアプローチは、WebSocketベースのプラットフォームとは異なるアーキテクチャが必要

---

**最終更新**: 2025-10-10
**Claude Code バージョン**: Sonnet 4.5 (claude-sonnet-4-5-20250929)
**セッションタイプ**: 実装セッション
