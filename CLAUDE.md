# Claude Codeを使った開発

このドキュメントは、Anthropic社のAI支援コーディングアシスタント「Claude Code」を使った開発作業のルールと規約を記録します。

## 言語設定

このプロジェクトでは**日本語**での応答を行ってください。コード内のコメント、ログメッセージ、エラーメッセージ、ドキュメンテーション文字列などは英文で記述してください。

## 開発ルール

### コーディング規約

- Python: PEP 8準拠
- 関数名: snake_case
- クラス名: PascalCase
- 定数: UPPER_SNAKE_CASE
- Docstring: Google Style

### Git運用

- ブランチ戦略: feature/*, fix/*, refactor/*
- コミットメッセージ: 英文を使用、動詞から始める
- PRはmainブランチへ

## 開発ガイドライン

### ドキュメント更新プロセス

機能追加やPhase完了時には、以下のドキュメントを同期更新する：

1. **CLAUDE.md**: プロジェクト全体の開発ルール
2. **README.md**: ユーザー向け機能概要、実装状況、使用方法
3. **.claude-notes/sessions/**: 各セッションの履歴と技術的詳細

### コミットメッセージ規約

#### コミット粒度

- **1コミット = 1つの主要な変更**: 複数の独立した機能や修正を1つのコミットにまとめない
- **論理的な単位でコミット**: 関連する変更は1つのコミットにまとめる
- **段階的コミット**: 大きな変更は段階的に分割してコミット

#### プレフィックスと絵文字

- ✨ feat: 新機能
- 🐞 fix: バグ修正
- 📚 docs: ドキュメント
- 🎨 style: コードスタイル修正
- 🛠️ refactor: リファクタリング
- ⚡ perf: パフォーマンス改善
- ✅ test: テスト追加・修正
- 🏗️ chore: ビルド・補助ツール
- 🚀 deploy: デプロイ
- 🔒 security: セキュリティ修正
- 📝 update: 更新・改善
- 🗑️ remove: 削除

**重要**: Claude Codeを使用してコミットする場合は、必ず以下の署名を含める：

```text
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## セッション履歴

各開発セッションの詳細な履歴は以下のディレクトリに保存されています：

- [.claude-notes/sessions/](./.claude-notes/sessions/) - 開発セッションの記録

### 主要なセッション

- [2025-10-10: YouTube Live Chat Integration](./.claude-notes/sessions/2025-10-10-youtube-integration.md) - YouTube Live配信機能の統合
- [2025-10-16: TTS Voice Configuration Fix](./.claude-notes/sessions/2025-10-16-tts-voice-fix.md) - 環境変数からのTTS設定読み込みバグ修正
- [2025-10-17: YouTube Streaming Mode UI](./.claude-notes/sessions/2025-10-17-streaming-mode-ui.md) - YouTube配信向けUIカスタマイズ機能の実装
- [2025-10-17: Idle Talk with Knowledge DB](./.claude-notes/sessions/2025-10-17-idle-talk.md) - アイドル状態でのランダム話題会話機能の実装

## 将来の拡張計画

将来の機能拡張や改善案については以下のドキュメントを参照：

- [.claude-notes/future-enhancements.md](./.claude-notes/future-enhancements.md) - 将来の拡張計画

## このドキュメントの使い方

このドキュメントは以下の目的で使用されます：

1. **開発ルールの共有**: コーディング規約、Git運用方針の統一
2. **知識の継承**: 将来の開発者がコードベースを理解するための支援
3. **コンテキストの保持**: セッション間でのコンテキスト維持

### 今後のセッションのために

この作業を続ける際：

1. まずこのドキュメントを確認
2. gitブランチの状態を確認
3. TODOアイテムを確認（ある場合）
4. 実装を続けるか、新機能を開始

### コントリビュート

Claude Codeを使ってこのプロジェクトに貢献する場合：

1. このドキュメントを読んで既存の作業を理解
2. 確立されたパターンに従う
3. セッションノートで`.claude-notes/sessions/`を更新
4. プロジェクトの規約との一貫性を維持

## リソース

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [Project AIRI Repository](https://github.com/moeru-ai/airi)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## 実装済み機能

### stage-web

- ✅ **YouTube配信向けUIカスタマイズ** - ヘッダー、チャット応答、入力欄の表示切替
- ✅ **Knowledge DB統合** - RAGによる文脈に応じた知識の提供
- ✅ **Idle Talk機能** - アイドル状態でのランダム話題会話（Phase 1完了）
  - タイマーベースのアイドル検知
  - Knowledge DBからのランダム話題取得
  - LLM応答生成とTTS音声再生
  - 環境変数でのON/OFF制御

### knowledge-db

- ✅ **PostgreSQL + pgvector** - ベクトル類似度検索
- ✅ **Discord メッセージ収集** - リアルタイム収集と自動ベクトル化
- ✅ **RAG統合** - `/knowledge` エンドポイント
- ✅ **ランダム話題取得** - `/knowledge/random` エンドポイント（Idle Talk用）

---

**最終更新**: 2025-10-17
**Claude Code バージョン**: Sonnet 4.5 (claude-sonnet-4-5-20250929)
