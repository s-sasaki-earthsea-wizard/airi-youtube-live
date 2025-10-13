# Development with Claude Code

This document tracks development work done using Claude Code, an AI-powered coding assistant by Anthropic.

# 言語設定

このプロジェクトでは**日本語**での応答を行ってください。コード内のコメント、ログメッセージ、エラーメッセージ、ドキュメンテーション文字列なども日本語で記述してください。

## 開発ルール

### コーディング規約

- Python: PEP 8準拠
- 関数名: snake_case
- クラス名: PascalCase
- 定数: UPPER_SNAKE_CASE
- Docstring: Google Style

## Git運用

- ブランチ戦略: feature/*, fix/*, refactor/*
- コミットメッセージ: 英文を使用、動詞から始める
- PRはmainブランチへ

## 開発ガイドライン

### ドキュメント更新プロセス

機能追加やPhase完了時には、以下のドキュメントを同期更新する：

1. **CLAUDE.md**: プロジェクト全体状況、Phase完了記録、技術仕様
2. **README.md**: ユーザー向け機能概要、実装状況、使用方法

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

## Session History

### 2025-10-10: YouTube Live Chat Integration

**Branch**: `feat/youtube-live-chat-integration`

**Objective**: Implement YouTube Live Chat integration to enable AIRI to interact with viewers during YouTube live streams, similar to Discord and Telegram bot integrations.

#### Tasks Completed

1. ✅ **Project Investigation**
   - Analyzed existing bot implementations (Discord, Telegram)
   - Reviewed project structure and conventions
   - Identified integration patterns and dependencies

2. ✅ **Architecture Design**
   - Designed YouTube Live Chat polling system
   - Planned OAuth 2.0 authentication flow
   - Outlined message handling and AI response pipeline

3. ✅ **Implementation**
   - Created complete YouTube bot service in `services/youtube-bot/`
   - Implemented OAuth 2.0 authentication (`youtube/auth.ts`)
   - Built YouTube API client wrapper (`youtube/client.ts`)
   - Developed live chat polling mechanism (`youtube/live-chat-poller.ts`)
   - Created message handler with LLM and TTS integration (`handlers/message-handler.ts`)
   - Set up main entry point with graceful shutdown (`index.ts`)

4. ✅ **Configuration**
   - Created `package.json` with appropriate dependencies
   - Set up TypeScript configuration (`tsconfig.json`)
   - Provided environment variable template (`.env.example`)
   - Defined TypeScript types (`types.ts`)

5. ✅ **Documentation**
   - Created comprehensive README for youtube-bot service
   - Added integration guide to project documentation (`docs/content/en/docs/integrations/youtube-live-chat.md`)
   - Documented setup process, configuration options, and troubleshooting

#### Files Created

```
services/youtube-bot/
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── .env.example                     # Environment variable template
├── README.md                        # Service-specific documentation
└── src/
    ├── index.ts                     # Main entry point
    ├── types.ts                     # TypeScript type definitions
    ├── youtube/
    │   ├── auth.ts                  # OAuth 2.0 authentication
    │   ├── client.ts                # YouTube API client wrapper
    │   └── live-chat-poller.ts      # Live chat polling logic
    └── handlers/
        └── message-handler.ts       # Message processing with LLM/TTS

docs/content/en/docs/integrations/
└── youtube-live-chat.md             # Integration documentation
```

#### Technical Decisions

**YouTube API Approach**
- Used polling-based approach (YouTube doesn't provide WebSocket API)
- Implemented 5-second default polling interval (configurable)
- Added message deduplication using Set of processed IDs
- Respects YouTube's recommended `pollingIntervalMillis` from API responses

**Authentication**
- OAuth 2.0 with refresh token for long-running sessions
- Separate authentication script (`pnpm auth`) for token generation
- Secure credential storage in `.env` file

**Message Processing**
- LLM integration via existing `@xsai/generate-text` package
- TTS integration via existing `@xsai/generate-speech` package
- Conversation history management (max 20 messages)
- Special handling for Super Chats with amount display

**Architecture Pattern**
- Followed existing bot patterns (Discord/Telegram)
- Separation of concerns: Client → Poller → Handler
- Used existing logging infrastructure (`@guiiai/logg`)
- Consistent error handling and graceful shutdown

#### API Usage Considerations

- **Quota**: YouTube Data API v3 has 10,000 units/day limit
- **Cost per poll**: ~1 unit per `liveChatMessages.list` call
- **Estimated capacity**: ~10,000 polls/day at 5-second intervals
- **Optimization**: Polling interval adjusts based on YouTube's recommendations

#### Dependencies Added

```json
{
  "googleapis": "^140.0.0", // YouTube Data API v3 client
  "google-auth-library": "^9.0.0", // OAuth 2.0 authentication
  "@xsai/generate-text": "catalog:", // LLM integration (existing)
  "@xsai/generate-speech": "catalog:", // TTS integration (existing)
  "@guiiai/logg": "catalog:", // Logging (existing)
  "@dotenvx/dotenvx": "^1.51.0" // Environment variable management
}
```

#### Integration Features

- ✅ Real-time chat monitoring (2-5 second latency)
- ✅ AI-powered response generation
- ✅ Text-to-Speech audio file creation
- ✅ Super Chat detection and special handling
- ✅ Conversation context management
- ✅ Automatic message deduplication
- ✅ Graceful error handling and recovery
- ✅ OBS-compatible audio output

#### Known Limitations

1. **Polling Delay**: 2-10 seconds due to polling-based approach (no WebSocket API available from YouTube)
2. **API Quota**: Limited to 10,000 units/day (manageable with proper interval configuration)
3. **No Direct Chat Posting**: Current implementation generates audio only; chat posting is optional and requires additional quota
4. **Single Stream**: Bot connects to one active stream at a time (can run multiple instances for multiple streams)

#### Future Enhancements

Potential improvements for future iterations:

##### Near-term Features

- [ ] **Idle Talk Feature with RAG Integration**: Automatic speech generation when no comments are received
  - **RAG-powered topic generation**: DBからランダムにトピックをサンプリングして自然な独り言を生成
  - **従来アプローチ（same-vtg-AITuber）の課題**: 固定テンプレート（童話、技術トレンド等）でバリエーション不足
  - **RAG統合の利点**:
    - 無限のバリエーション（DB内の全コンテンツが話題候補）
    - ユーザーの実際の発言ベースで自然な一貫性
    - 新しいツイート/ブログが自動で話題に
    - メンテナンス不要（コード修正不要）

  **実装戦略（4パターン）:**

  1. **ランダムトピック戦略（40%）**
     ```typescript
     // DBから完全ランダムに3件サンプリング
     SELECT content, category FROM knowledge_base
     WHERE category IN ('hobby', 'tech', 'opinion', 'music')
     ORDER BY RANDOM() LIMIT 3

     // プロンプト例:
     // 「以下のトピックから1つ選んで自然に語る（150-200文字）
     //  - 宝塚の花組が好き
     //  - Rustの所有権システムが素晴らしい
     //  - The Clashの「London Calling」は名盤」
     ```

  2. **カテゴリ集中戦略（30%）**
     ```typescript
     // ランダムにカテゴリを選択し、そのカテゴリから5件サンプリング
     const category = random(['hobby', 'tech', 'music', 'opinion'])
     SELECT content FROM knowledge_base
     WHERE category = $1 ORDER BY RANDOM() LIMIT 5

     // 例: 音楽カテゴリなら
     // 「今日は音楽について話そうかな。私はロック、特にパンクが好きで...」
     ```

  3. **最近の興味戦略（20%）**
     ```typescript
     // 最近30日間に追加されたコンテンツから
     SELECT content FROM knowledge_base
     WHERE created_at > NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC LIMIT 5

     // 例:
     // 「最近ね、Zig言語っていうのに興味が出てきてさ...」
     ```

  4. **前回話題の拡張戦略（10%）**
     ```typescript
     // 前回の独り言に関連するコンテンツをRAG検索
     const embedding = await generateEmbedding(lastIdleTalk)
     SELECT content FROM knowledge_base
     WHERE 1 - (embedding <=> $1::vector) > 0.75
     ORDER BY embedding <=> $1::vector LIMIT 3

     // 例:
     // 「さっきRustの話をしたけど、もうちょっと続けるとね、
     //  あのborrow checkerのおかげで...」
     ```

  **高度な拡張（オプション）:**
  - タグベースの連想（`tags && $1::text[]` で関連トピック検索）
  - 感情・トーン調整（最近の投稿のsentiment分析）
  - 時間帯による話題選択（深夜→哲学的、日中→技術的）
  - カテゴリバランス調整（DB内の割合で自然にバランス）

  **実装例:**
  ```typescript
  // services/youtube-bot/src/handlers/idle-talk-handler.ts
  export class IdleTalkHandler {
    async generateIdleTalk(): Promise<string> {
      const strategy = this.selectStrategy() // 確率的に選択

      switch (strategy) {
        case 'random_topic':
          return await this.generateFromRandomTopics()
        case 'category_focused':
          return await this.generateFromCategory()
        case 'recent_interest':
          return await this.generateFromRecentInterests()
        case 'expand_previous':
          return await this.expandPreviousTopic() // RAG検索使用
      }
    }
  }
  ```

  **期待される効果:**
  - 従来の固定4パターン → DB内の数千パターンに拡大
  - テンプレート的 → ユーザーの実際の発言から生成で自然
  - コード修正必要 → 新しいツイート/ブログが自動反映
  - 独立した話題 → 前回の話題を引き継げる（文脈の連続性）

  **Reference:**
  - 基本実装: `same-vtg-AITuber/app/src/live/talker.py` and `AITuberSystem.py`
  - RAG統合: Long-term Vision の RAG-based Personalized Knowledge System を参照
- [ ] Chat message posting (optional feature)
- [ ] Multi-stream support in single instance
- [ ] Advanced message filtering (spam detection, user blacklist)
- [ ] Sentiment analysis for adaptive responses
- [ ] Integration with OBS WebSocket for automatic audio playback
- [ ] Chat statistics and analytics
- [ ] Custom command handling (e.g., `!help`, `!info`)
- [ ] Member-only chat support
- [ ] Emoji and sticker interpretation
- [ ] Translation support for multilingual chats

##### Long-term Vision: RAG-based Personalized Knowledge System

**概要**
ユーザー（Syotaさん）のブログ、Twitter、SNS投稿などをベクトルデータベースに格納し、セマンティック検索でユーザーの知識・考え方・趣味嗜好を反映した応答を生成する。

**アーキテクチャ**

```
┌─────────────────────────────────────┐
│  コンテンツソース                     │
├─────────────────────────────────────┤
│ - 鍵アカウントのTwitter/X             │
│ - 非公開ブログ（はてな、WordPress等）  │
│ - Mastodon/Bluesky                  │
│ - 手動入力（趣味、好み、意見）         │
└─────────────┬───────────────────────┘
              │ OAuth認証で取得
              │ （鍵垢・非公開でもOK）
              ↓
┌─────────────────────────────────────┐
│  Knowledge Crawler                  │
│  services/knowledge-crawler/        │
├─────────────────────────────────────┤
│ - Twitter API (OAuth 2.0)          │
│ - Hatena Blog (AtomPub API)        │
│ - Mastodon API                      │
│ - WordPress REST API                │
│ - テキスト前処理・正規化              │
│ - 重複除去                           │
└─────────────┬───────────────────────┘
              │
              ↓ OpenAI Embeddings API
              │ （ベクトル化）
┌─────────────────────────────────────┐
│  RDS PostgreSQL + pgvector          │
│  knowledge_base テーブル             │
├─────────────────────────────────────┤
│ - content: TEXT                     │
│ - embedding: vector(1536)           │
│ - source: VARCHAR (twitter/blog)    │
│ - category: VARCHAR (hobby/tech)    │
│ - tags: TEXT[]                      │
│ - metadata: JSONB                   │
│ - created_at: TIMESTAMP             │
└─────────────┬───────────────────────┘
              │
              ↓ ベクトル検索 (<=> 演算子)
┌─────────────────────────────────────┐
│  RAG Search Engine                  │
│  packages/rag-engine/               │
├─────────────────────────────────────┤
│ - セマンティック検索                  │
│ - コサイン類似度計算                  │
│ - カテゴリフィルタリング              │
│ - スコアリング・ランキング            │
└─────────────┬───────────────────────┘
              │
              ↓ コンテキスト注入
┌─────────────────────────────────────┐
│  YouTube Bot (Message Handler)      │
├─────────────────────────────────────┤
│ 質問: "宝塚では何組が好き？"          │
│                                     │
│ RAG検索結果:                         │
│ - "花組の芝居が最高" (類似度: 0.92) │
│ - "雪組のトップスター好き" (0.89)   │
│                                     │
│ プロンプト:                          │
│ 「あなたの過去の発言:               │
│  - 花組の芝居が最高                 │
│  - 雪組のトップスター好き           │
│                                     │
│  上記を踏まえて答えてください」      │
│                                     │
│ → LLM応答: "花組と雪組が特に好き..." │
└─────────────────────────────────────┘
```

**技術選定**

| コンポーネント | 技術 | 理由 |
|--------------|------|------|
| ベクトルDB | PostgreSQL + pgvector | 既存インフラ活用、シンプル、SQL互換 |
| Embedding | OpenAI Embeddings API | GPU不要、高品質、激安（月1円以下） |
| クローラー | Node.js + OAuth 2.0 | 鍵アカウント・非公開コンテンツに対応 |
| 検索手法 | セマンティック検索（コサイン類似度） | 形態素解析不要、同義語・表記ゆれに強い |

**ベクトル検索の仕組み**

```typescript
// 1. テキストをベクトル化（OpenAI APIに投げるだけ）
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",  // 1536次元ベクトル
  input: "宝塚では何組が好き？"
})
// → [0.023, -0.891, 0.442, ..., 0.123]

// 2. ベクトル検索（コサイン類似度）
const results = await pool.query(`
  SELECT
    content,
    1 - (embedding <=> $1::vector) as similarity
  FROM knowledge_base
  WHERE 1 - (embedding <=> $1::vector) > 0.75  -- 閾値
  ORDER BY embedding <=> $1::vector
  LIMIT 5
`, [JSON.stringify(embedding)])

// 結果:
// - "花組の芝居が素晴らしい" (0.92) ← "宝塚"という単語なしでもヒット！
// - "雪組のトップスターが好き" (0.89)
// - "タカラジェンヌの歌唱力すごい" (0.87)
```

**重要ポイント:**
- ✅ **形態素解析不要**: ベクトル検索は意味的類似性で検索するため
- ✅ **キーワード一致不要**: "宝塚"という単語が含まれていなくてもヒット
- ✅ **同義語・表記ゆれに強い**: "宝塚" "ヅカ" "タカラジェンヌ" すべて意味的に近い
- ✅ **ローカル推論不要**: OpenAI APIに投げるだけ、GPU不要
- ✅ **激安**: 1万文書のベクトル化で約10円、月次更新は1円以下

**データベーススキーマ（最終設計）**

```sql
CREATE EXTENSION vector;

CREATE TABLE knowledge_base (
  -- プライマリーキー: SERIAL（シンプルで効率的、デバッグが容易）
  id SERIAL PRIMARY KEY,

  -- コンテンツ
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,

  -- メタデータ
  source VARCHAR(50) NOT NULL,        -- 'twitter', 'blog', 'mastodon', 'manual'
  source_id VARCHAR(100) NOT NULL,    -- Tweet ID, Blog URL等（重複排除に使用）
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,                     -- カテゴリ、タグ等の任意情報

  -- 重複排除制約
  UNIQUE(source, source_id)
);

-- ベクトル検索用インデックス（高速化）
CREATE INDEX knowledge_embedding_idx
ON knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 時系列検索用インデックス
CREATE INDEX knowledge_created_at_idx
ON knowledge_base (created_at DESC);

-- ソース別フィルタリング用インデックス
CREATE INDEX knowledge_source_idx
ON knowledge_base (source);

-- メタデータ検索用インデックス（JSONB）
CREATE INDEX knowledge_metadata_idx
ON knowledge_base USING gin (metadata);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON knowledge_base
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**設計上の意思決定:**

1. **SERIAL vs UUID**
   - ✅ **SERIAL採用**: シンプル、効率的、デバッグが容易
   - 単一データベースでの運用なので分散ID不要
   - シーケンシャルIDでB-treeインデックスが効率的
   - 1, 2, 3... の連番でログ確認が容易

2. **重複排除戦略**
   - `UNIQUE(source, source_id)` 制約で確実に重複排除
   - `source_id`: Tweet ID（例: "1234567890"）やブログURL（例: "https://blog.example.com/post-123"）
   - コンテンツハッシュではなく、外部IDベースで管理（より確実）

3. **metadata JSONB**
   - カテゴリ、タグ等の柔軟な格納
   - スキーマ変更なしで属性追加可能
   - GINインデックスで高速検索

4. **インデックス設計**
   - ベクトル検索（ivfflat）: セマンティック検索の高速化
   - 時系列（created_at DESC）: 最近の投稿優先検索
   - ソース（source）: Twitter/ブログ別フィルタリング
   - メタデータ（GIN）: カテゴリ・タグ検索

**使用例:**

```typescript
// 重複を防いでインサート（ON CONFLICT）
await pool.query(`
  INSERT INTO knowledge_base (content, embedding, source, source_id, created_at, metadata)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (source, source_id) DO UPDATE
  SET content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
`, [content, embedding, 'twitter', tweetId, createdAt, { category: 'tech', tags: ['rust'] }])

// カテゴリフィルタ付きRAG検索
const results = await pool.query(`
  SELECT content, 1 - (embedding <=> $1::vector) as similarity
  FROM knowledge_base
  WHERE metadata->>'category' = $2
    AND 1 - (embedding <=> $1::vector) > 0.75
  ORDER BY embedding <=> $1::vector
  LIMIT 5
`, [queryEmbedding, 'tech'])
```

**実装フェーズ**

```
Phase 1: 基礎インフラ（1-2週間）
├─ RDS PostgreSQL + pgvector セットアップ
├─ テーブル設計・マイグレーション
├─ 手動データ投入スクリプト
└─ 基本的なベクトル検索テスト

Phase 2: RAG検索エンジン（1週間）
├─ @proj-airi/rag-engine パッケージ作成
├─ OpenAI Embeddings API 統合
├─ ベクトル検索実装
└─ カテゴリフィルタリング・スコアリング

Phase 3: コンテンツクローラー（2-3週間）
├─ Twitter OAuth 2.0 認証（鍵アカウント対応）
├─ はてなブログ AtomPub API 統合
├─ Mastodon/Bluesky API 統合
├─ テキスト前処理・重複除去
└─ 定期実行（cron / systemd timer）

Phase 4: YouTube Bot 統合（1週間）
├─ message-handler に RAG検索統合
├─ プロンプト構築ロジック
├─ 応答品質調整（閾値、top-k、カテゴリフィルタ）
└─ A/Bテスト・評価

Phase 5: 高度な機能（オプション）
├─ ハイブリッド検索（ベクトル + 全文検索）
├─ LLMによるリランキング
├─ 管理WebUI（知識追加・編集）
└─ 検索分析・ダッシュボード
```

**コスト試算**

```
【初回インデックス化】
- Twitter 5,000ツイート（平均100文字） = 約0.4円
- ブログ 100記事（平均2,000文字） = 約0.15円
- 合計: 約0.5円

【月次運用コスト】
- 新規ツイート 10件/日 × 30日 = 300件 = 約0.07円/月
- 検索時のベクトル化: 100クエリ = 約0.01円
- 合計: 約0.1円/月

【RDS PostgreSQL】
- db.t4g.micro (20GB): 約$15/月 = 約2,200円/月
  ※ 既存RDSインスタンスを流用可能

【OpenAI API（既存使用分に追加）】
- Embeddings: 約0.1円/月（誤差レベル）
```

**メリット**

1. **パーソナライゼーション**
   - ユーザーの実際の考え・趣味・知識を反映
   - 一貫性のある応答（「昔はこう言ってたけど今は違う」問題を回避）

2. **自動更新**
   - 鍵アカウントのTwitter/ブログから自動同期
   - 手動INSERT不要
   - 時系列で考えの変化も追跡可能

3. **プライバシー保護**
   - 鍵アカウント・非公開ブログから取得
   - RDS内に安全に保管
   - 外部に漏れない

4. **拡張性**
   - 新しいソースを簡単に追加可能（Bluesky、Misskey等）
   - カテゴリやタグでフィルタリング
   - ハイブリッド検索などの高度な機能に拡張可能

5. **低コスト**
   - 月額コストは実質RDS代のみ（約2,200円）
   - Embeddings APIは誤差レベル（月0.1円）
   - GPUサーバー不要

**技術的課題と解決策**

| 課題 | 解決策 |
|------|--------|
| 検索精度の調整 | 閾値（minSimilarity）の調整、カテゴリフィルタ、top-kの最適化 |
| 古い情報の扱い | 時系列フィルタ、最新情報に重み付け、定期的なリインデックス |
| コンテキスト長制限 | 検索結果を要約、最も関連性の高いもののみ選択 |
| リアルタイム性 | 定期クローリング（1時間ごと）、WebHook対応（将来） |
| 重複コンテンツ | ハッシュベースの重複除去、類似度による統合 |

**参考実装**

```typescript
// services/youtube-bot/src/handlers/message-handler.ts
import { searchKnowledge } from '@proj-airi/rag-engine'

async generateResponse(msg: YouTubeLiveChatMessage): Promise<string> {
  // RAG検索で関連知識を取得
  const knowledge = await searchKnowledge(msg.message, {
    limit: 3,
    minSimilarity: 0.75,
    // カテゴリヒント（オプション）
    category: await this.inferCategory(msg.message)
  })

  if (knowledge.length === 0) {
    // 関連知識がない場合は一般的な応答
    return await this.generateGenericResponse(msg)
  }

  // コンテキスト構築
  const context = knowledge
    .map((k, i) => `${i + 1}. [${k.source}] ${k.content}`)
    .join('\n')

  const systemPrompt = `
あなたはSyotaさんの代わりにYouTube配信で応答するAIです。

Syotaさんの関連する過去の発言:
${context}

上記の知識を参考にしつつ、視聴者の質問に自然に答えてください。
過去の発言と矛盾しないように注意してください。
`

  const result = await generateText({
    messages: [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: `${msg.authorName}: ${msg.message}` }
    ]
  })

  return result.text.trim()
}
```

**バックアップ・復旧戦略**

RAG-based Knowledge Systemの大きな副次的メリットとして、**自然なバックアップ機構**が実現されます。

**アーキテクチャ上の冗長性:**
```
SNS（Twitter/ブログ等）
    ↓
真実の源泉（Source of Truth）- 常に最新データが存在
    ↓
RDS PostgreSQL + pgvector
    ↓
キャッシュ層・高速検索層
    ↓
万が一消失しても...OAuth認証があればSNSから完全復元可能
```

**従来のDBバックアップとの比較:**

| 項目 | 従来のDB | SNS連携アーキテクチャ |
|------|---------|---------------------|
| バックアップ頻度 | 日次/時間単位 | リアルタイム（SNS側） |
| バックアップコスト | 高（ストレージ代） | ゼロ（SNSが保管） |
| 復元時間 | 数時間 | 10-15分 |
| 復元の複雑さ | 高 | 低（スクリプト1本） |
| Point-in-Time Recovery | 可能（複雑） | 可能（SNS APIで期間指定） |
| データ整合性 | スナップショット時点 | 常に最新 |
| 多重障害耐性 | RDS障害で全損 | SNS側が生きていれば復元可能 |

**災害復旧（DR）手順:**
```bash
# シナリオ: RDS完全消失

# 1. 新しいRDSインスタンス作成
aws rds create-db-instance --db-instance-identifier airi-new

# 2. pgvectorセットアップ
psql -c "CREATE EXTENSION vector"
psql -f migrations/schema.sql

# 3. 全データ復元（自動）
pnpm knowledge:restore-all

# 実行内容:
# - Twitter OAuth認証
# - 全ツイート取得（5,000件）
# - ベクトル化してインサート（OpenAI Embeddings API）
# - はてなブログ等も同様に処理
#
# 所要時間: 約10-15分
# コスト: Embeddings APIで約0.5円
```

**副次的メリット:**

1. **ゼロコストバックアップ** - SNSがバックアップを担保
2. **高速復旧** - 10-15分で完全復元
3. **完全自動化** - スクリプト1本で復元
4. **マルチリージョン展開が容易** - どこでも復元可能
5. **開発環境の簡単セットアップ** - 本番相当データで即座に開発
6. **データのバージョン管理** - 特定時点のデータを復元可能
7. **コスト最適化** - RDSスナップショット・レプリケーション不要で月額26,000-50,000円削減

**実運用での更新戦略:**

EC2インスタンスは配信時と開発時のみ起動するため、**配信開始時の手動更新**が最適：

```bash
# 配信開始時（推奨フロー）
make stream-start

# 実行内容:
# 1. 知識ベース更新（差分のみ、1-2分）
# 2. 統計表示で確認
# 3. YouTube Bot 自動起動
```

**メリット:**
- ✅ 最もシンプル（cronやsystemd timer不要）
- ✅ コスト最小（EC2停止中は更新しない）
- ✅ 確実性（配信前に最新データを確認）
- ✅ トラブル回避（更新エラーを配信前に検知）

**Makefile実装例:**
```makefile
# Makefile

.PHONY: stream-start stream-stop stream-status

stream-start:
	@echo "🚀 Starting streaming session..."
	@pnpm knowledge:update --quiet
	@pnpm knowledge:stats
	@pnpm -F @proj-airi/youtube-bot start

stream-stop:
	@echo "🛑 Stopping stream..."
	@pkill -f youtube-bot || true
	@echo "✅ Stream stopped"

stream-status:
	@pnpm knowledge:stats
	@ps aux | grep youtube-bot | grep -v grep || echo "❌ Bot not running"
```

**起動前チェックリスト自動化:**
```typescript
// scripts/pre-stream-check.ts
async function preStreamCheck() {
  const checks = [
    { name: '知識ベース更新', fn: updateKnowledge },
    { name: 'YouTube認証', fn: checkYouTubeAuth },
    { name: 'LLM API接続', fn: checkLLMAPI },
    { name: 'TTS API接続', fn: checkTTSAPI },
    { name: 'OBS接続', fn: checkOBS }
  ]

  for (const check of checks) {
    try {
      console.log(`🔍 Checking ${check.name}...`)
      await check.fn()
      console.log(`✅ ${check.name} OK`)
    } catch (err) {
      console.error(`❌ ${check.name} failed:`, err)
      process.exit(1)
    }
  }

  console.log('\n🎉 All checks passed! Ready to stream.')
}
```

**コストシミュレーション（週2回、各3時間配信）:**
```
EC2稼働時間:
- 配信: 週2回 × 3時間 = 6時間/週
- 開発: 週5時間
- 合計: 約44時間/月

EC2コスト (t3.medium): $0.0416 × 44時間 = 約270円/月
知識ベース更新: 週2回 × 4週 × 0.01円 = 約0.08円/月
RDS (常時起動): 約2,200円/月

合計: 約2,470円/月

24時間稼働の場合: 約6,650円/月
差額: 4,180円/月の節約
```

**参考資料**

- [PostgreSQL pgvector](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [RAG (Retrieval-Augmented Generation)](https://arxiv.org/abs/2005.11401)
- [LangChain](https://python.langchain.com/docs/use_cases/question_answering/)
- [LlamaIndex](https://docs.llamaindex.ai/)

#### Testing Recommendations

To test the implementation:

1. Set up Google Cloud Console project and OAuth credentials
2. Run authentication flow: `pnpm auth`
3. Configure `.env` with all required credentials
4. Start a YouTube live stream
5. Run the bot: `pnpm -F @proj-airi/youtube-bot start`
6. Send test messages in the live chat
7. Verify audio files are generated in `audio-output/`
8. Test Super Chat functionality
9. Verify conversation context is maintained
10. Test graceful shutdown (Ctrl+C)

#### Environment Setup

Required environment variables:

```env
# YouTube OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=1//0xxx

# LLM Provider
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-xxx

# TTS Provider
TTS_PROVIDER=openai-audio-speech
TTS_MODEL=tts-1
TTS_VOICE=alloy
TTS_API_KEY=sk-xxx

# Configuration
POLLING_INTERVAL_MS=5000
AUDIO_OUTPUT_DIR=./audio-output
LOG_LEVEL=info
```

#### Documentation Structure

```
docs/content/en/docs/integrations/youtube-live-chat.md
├── Overview
├── Prerequisites
├── Setup Instructions
│   ├── 1. Enable YouTube Data API v3
│   ├── 2. Configure Environment Variables
│   ├── 3. Authenticate with Google
│   └── 4. Install Dependencies
├── Running the Bot
├── OBS Integration (3 methods)
├── Configuration Options
├── Technical Details
│   ├── Architecture Diagram
│   └── API Usage and Limitations
├── Troubleshooting
├── Advanced Usage
└── Development Information
```

---

## Development Workflow with Claude Code

### Approach

1. **Investigation Phase**
   - Read existing implementations
   - Understand project conventions
   - Identify integration patterns

2. **Planning Phase**
   - Design architecture
   - Plan file structure
   - Define interfaces and types

3. **Implementation Phase**
   - Follow existing patterns
   - Write modular, testable code
   - Use project's existing utilities

4. **Documentation Phase**
   - Create README for the service
   - Add integration guide to docs
   - Document setup and troubleshooting

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **Error Handling**: Comprehensive try-catch blocks with logging
- **Logging**: Consistent use of `@guiiai/logg`
- **Configuration**: Environment-based configuration
- **Code Style**: Followed existing ESLint configuration

### Lessons Learned

1. **Pattern Recognition**: Existing Discord/Telegram bots provided excellent templates
2. **Incremental Development**: Building in logical order (auth → client → poller → handler)
3. **Documentation First**: Creating clear documentation helps validate design
4. **API Limitations**: YouTube's polling-only approach requires different architecture than WebSocket-based platforms

---

## How to Use This Document

This document serves as:

1. **Development Log**: Track what was built and why
2. **Decision Record**: Document technical decisions and trade-offs
3. **Knowledge Transfer**: Help future developers understand the codebase
4. **Context Preservation**: Maintain context across sessions

### For Future Sessions

When continuing this work:

1. Review this document first
2. Check the git branch status
3. Review TODO items (if any)
4. Continue implementation or start new features

### Contributing

If you're using Claude Code to contribute to this project:

1. Read this document to understand existing work
2. Follow the established patterns
3. Update this document with your session notes
4. Maintain consistency with project conventions

---

## Resources

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [Project AIRI Repository](https://github.com/moeru-ai/airi)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Last Updated**: 2025-10-10
**Claude Code Version**: Sonnet 4.5 (claude-sonnet-4-5-20250929)
**Session Type**: Implementation Session
