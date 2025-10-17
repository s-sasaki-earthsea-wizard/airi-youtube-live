# 将来の拡張計画

このドキュメントは、YouTube Bot統合の将来的な改善と拡張について記述します。

## 近期的な機能

### リアルタイム通知の実装（ポーリング最適化）

現在のポーリング方式を改善し、APIクォータ使用量を削減しつつ遅延を最小化します。

#### 背景
- **現状**: 10秒ごとに固定ポーリング
- **問題点**:
  - APIクォータを常時消費（10,000 units/日）
  - コメントがない時も無駄なリクエスト
  - 2-10秒の遅延が発生

#### YouTube API の制約
- ❌ ライブチャット用のWebhook/Push通知は**提供されていない**
- ❌ PubSubHubbub: 動画アップロード/メタデータ変更のみ対応（ライブチャットは非対応）
- ❌ Server-Sent Events (SSE): 公式APIでは明確な実装方法が不明

#### 推奨アプローチ: 適応的ポーリング

コメント頻度に応じて動的にポーリング間隔を調整：

```typescript
// services/youtube-bot/src/youtube/adaptive-poller.ts

class AdaptivePoller {
  private baseInterval = 10000  // 10秒（デフォルト）
  private minInterval = 2000    // 2秒（高頻度時）
  private maxInterval = 30000   // 30秒（非活動時）

  private currentInterval = this.baseInterval
  private messageHistory: number[] = []

  calculateNextInterval() {
    // 過去1分間のメッセージ数をカウント
    const recentMessages = this.messageHistory
      .filter(time => Date.now() - time < 60000)
      .length

    if (recentMessages > 20) {
      // 非常に活発: 2秒
      return this.minInterval
    } else if (recentMessages > 5) {
      // 中程度の活動: 5秒
      return 5000
    } else if (recentMessages > 0) {
      // 低活動: 10秒
      return this.baseInterval
    } else {
      // 非活動: 30秒
      return this.maxInterval
    }
  }

  async poll() {
    const messages = await this.fetchMessages()

    // メッセージタイムスタンプを記録
    messages.forEach(msg => {
      this.messageHistory.push(msg.timestamp)
    })

    // 次回のポーリング間隔を計算
    this.currentInterval = this.calculateNextInterval()

    // 古い履歴を削除（メモリ節約）
    this.messageHistory = this.messageHistory
      .filter(time => Date.now() - time < 300000) // 5分
  }
}
```

#### メリット
- ✅ **APIクォータ削減**: 最大70%削減（非活動時30秒間隔）
- ✅ **遅延最小化**: 活発時は2秒間隔に短縮
- ✅ **公式API使用**: 安定性が高い
- ✅ **実装が容易**: 既存コードの小規模な改善

#### デメリット
- ❌ 依然として2-30秒の遅延（リアルタイムではない）
- ❌ APIクォータを消費（削減はされるが完全にゼロではない）

#### 代替アプローチ: pytchat（将来的な選択肢）

非公式のInnerTube APIを使用してリアルタイム通知を実現：

```
┌─────────────────┐
│  YouTube Live   │
└────────┬────────┘
         │ InnerTube API (WebSocket)
         ▼
┌─────────────────┐
│  pytchat-bridge │  ← 新しいPythonサービス
│    (Python)     │
└────────┬────────┘
         │ WebSocket/HTTP
         ▼
┌─────────────────┐
│  AIRI Server    │
└─────────────────┘
```

**メリット**:
- ✅ **真のリアルタイム**（数百ミリ秒の遅延）
- ✅ **APIクォータ不使用**
- ✅ **asyncio対応**、JSON出力対応

**デメリット**:
- ❌ **非公式APIに依存**（将来動作しなくなる可能性）
- ❌ **Pythonサービスの追加**が必要
- ❌ **メンテナンスリスク**

#### 実装優先度
1. **短期（推奨）**: 適応的ポーリングの実装（数時間で実装可能）
2. **中期（検討）**: pytchat-bridgeの評価とプロトタイプ
3. **長期**: YouTube公式のWebhook/SSE対応を待つ（可能性は低い）

#### 参考リソース
- [pytchat - PyPI](https://pypi.org/project/pytchat/)
- [YouTube Data API - PubSubHubbub](https://developers.google.com/youtube/v3/guides/push_notifications)
- [YouTube Live Chat API](https://developers.google.com/youtube/v3/live/docs/liveChatMessages)

---

### チャットメッセージ投稿（オプション機能）
- YouTube Live Chatに直接返信を投稿
- 追加のAPIクォータが必要

### マルチストリーム対応
- 単一インスタンスで複数のストリームをサポート
- ストリーム間でのリソース共有

### 高度なメッセージフィルタリング
- スパム検出
- ユーザーブラックリスト
- 不適切なコンテンツのフィルタリング

### センチメント分析と適応的応答
- メッセージの感情を分析
- 感情に応じて応答のトーンを調整

### OBS WebSocket統合
- 自動オーディオ再生
- シーン切り替え連携

### チャット統計と分析
- メッセージ数、視聴者数の追跡
- 人気トピックの分析
- ダッシュボード表示

### カスタムコマンドハンドリング
- `!help`, `!info`などのコマンド対応
- カスタムコマンドの定義

### メンバー限定チャット対応
- メンバーシップレベルの検出
- メンバー限定応答

### 絵文字とスタンプの解釈
- 絵文字の意味を理解
- スタンプに対する適切な応答

### 多言語チャット対応
- 自動言語検出
- リアルタイム翻訳

## アイドルトーク機能（RAG統合）

コメントがない時の自動発話機能。

### 概要
- **RAG駆動のトピック生成**: DBからランダムにトピックをサンプリングして自然な独り言を生成
- **従来アプローチ（same-vtg-AITuber）の課題**: 固定テンプレート（童話、技術トレンド等）でバリエーション不足
- **RAG統合の利点**:
  - 無限のバリエーション（DB内の全コンテンツが話題候補）
  - ユーザーの実際の発言ベースで自然な一貫性
  - 新しいツイート/ブログが自動で話題に
  - メンテナンス不要（コード修正不要）

### 実装戦略（4パターン）

#### 1. ランダムトピック戦略（40%）
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

#### 2. カテゴリ集中戦略（30%）
```typescript
// ランダムにカテゴリを選択し、そのカテゴリから5件サンプリング
const category = random(['hobby', 'tech', 'music', 'opinion'])
SELECT content FROM knowledge_base
WHERE category = $1 ORDER BY RANDOM() LIMIT 5

// 例: 音楽カテゴリなら
// 「今日は音楽について話そうかな。私はロック、特にパンクが好きで...」
```

#### 3. 最近の興味戦略（20%）
```typescript
// 最近30日間に追加されたコンテンツから
SELECT content FROM knowledge_base
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC LIMIT 5

// 例:
// 「最近ね、Zig言語っていうのに興味が出てきてさ...」
```

#### 4. 前回話題の拡張戦略（10%）
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

### 高度な拡張（オプション）
- タグベースの連想（`tags && $1::text[]` で関連トピック検索）
- 感情・トーン調整（最近の投稿のsentiment分析）
- 時間帯による話題選択（深夜→哲学的、日中→技術的）
- カテゴリバランス調整（DB内の割合で自然にバランス）

### 実装例
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

### 期待される効果
- 従来の固定4パターン → DB内の数千パターンに拡大
- テンプレート的 → ユーザーの実際の発言から生成で自然
- コード修正必要 → 新しいツイート/ブログが自動反映
- 独立した話題 → 前回の話題を引き継げる（文脈の連続性）

### 参考
- 基本実装: `same-vtg-AITuber/app/src/live/talker.py` and `AITuberSystem.py`
- RAG統合: Long-term Vision の RAG-based Personalized Knowledge System を参照

## 長期ビジョン: RAGベースのパーソナライズド知識システム

### 概要
ユーザー（Syotaさん）のブログ、Twitter、SNS投稿などをベクトルデータベースに格納し、セマンティック検索でユーザーの知識・考え方・趣味嗜好を反映した応答を生成する。

### 🎉 既存インフラの活用（実装の大幅な簡素化）

**重要な発見**: AIRIプロジェクトには既に**完璧なメモリシステム**が実装されており、新しいテーブルを作る必要がありません！

#### 既存の`memory_fragments`テーブルを活用

**参照ファイル**:
- スキーマ定義: `services/telegram-bot/src/db/schema.ts:110-136`
- DB接続: `services/telegram-bot/src/db/index.ts`
- Docker構成: `services/telegram-bot/docker-compose.yaml:1-16`

**テーブル構造**:
```typescript
// services/telegram-bot/src/db/schema.ts から抜粋
export const memoryFragmentsTable = pgTable('memory_fragments', {
  id: uuid().primaryKey().defaultRandom(),
  content: text().notNull(),
  memory_type: text().notNull(),  // 'working', 'short_term', 'long_term', 'muscle'
  category: text().notNull(),     // 'chat', 'relationships', 'people', 'life', etc.
  importance: integer().notNull().default(5),  // 1-10 scale
  emotional_impact: integer().notNull().default(0),  // -10 to 10 scale
  created_at: bigint({ mode: 'number' }).notNull(),
  last_accessed: bigint({ mode: 'number' }).notNull(),
  access_count: integer().notNull().default(1),
  metadata: jsonb().notNull().default({}),  // ← プラットフォーム情報を格納
  content_vector_1536: vector({ dimensions: 1536 }),
  content_vector_1024: vector({ dimensions: 1024 }),
  content_vector_768: vector({ dimensions: 768 }),
  // ... ベクトルインデックス (HNSW) も既に設定済み
})
```

#### Twitter/ブログを`memory_fragments`に保存する例

```typescript
import { useDrizzle } from '@proj-airi/telegram-bot/db'
import { memoryFragmentsTable } from '@proj-airi/telegram-bot/db/schema'

// Twitterのポストをインサート
await db.insert(memoryFragmentsTable).values({
  content: "宝塚の花組が本当に素晴らしい！",
  memory_type: 'long_term',  // 永続的な記憶
  category: 'hobby',         // または 'tech', 'opinion' など
  importance: 7,
  emotional_impact: 5,
  metadata: {
    source: 'twitter',       // ← プラットフォーム識別
    tweet_id: '1234567890',
    url: 'https://twitter.com/...',
    likes: 42,
    retweets: 10,
    created_at: '2025-10-01T12:00:00Z'
  },
  content_vector_1536: embedding  // OpenAI Embeddings API
})
```

#### YouTube Botでの検索例

```typescript
import { useDrizzle } from '@proj-airi/telegram-bot/db'
import { memoryFragmentsTable } from '@proj-airi/telegram-bot/db/schema'
import { sql } from 'drizzle-orm'

const db = useDrizzle()
const queryEmbedding = await generateEmbedding(userQuestion)

// ベクトル検索（既存機能をそのまま使用）
const memories = await db.select()
  .from(memoryFragmentsTable)
  .where(sql`
    metadata->>'source' IN ('twitter', 'hatena', 'note')
    AND 1 - (content_vector_1536 <=> ${queryEmbedding}::vector) > 0.75
  `)
  .orderBy(sql`content_vector_1536 <=> ${queryEmbedding}::vector`)
  .limit(3)
```

#### 必要な実装（大幅に簡素化）

**services/knowledge-crawler/** を新規作成（約500行）:
```
services/knowledge-crawler/
├── package.json
├── src/
│   ├── index.ts                    # メインエントリポイント
│   ├── importers/
│   │   ├── base-importer.ts        # 共通ロジック（ベクトル化、DB挿入）
│   │   ├── twitter-importer.ts     # Twitter OAuth → インポート
│   │   ├── hatena-importer.ts      # はてなブログ AtomPub → インポート
│   │   └── note-importer.ts        # note RSS/API → インポート
│   └── utils/
│       └── embeddings.ts           # OpenAI Embeddings API
```

**実装コード量の比較**:
- ❌ 新規テーブル方式: 約800行（スキーマ設計、マイグレーション、検索ロジック）
- ✅ 既存スキーマ活用: **約500行**（インポーターのみ）

#### データベース構成

**Docker構成** (`services/telegram-bot/docker-compose.yaml`):
```yaml
services:
  pgvector:
    image: ghcr.io/tensorchord/pgvecto-rs:pg17-v0.4.0
    ports:
      - 5433:5432  # ホスト5433 → コンテナ5432
    environment:
      POSTGRES_PASSWORD: '123456'
    volumes:
      - ./.postgres/data:/var/lib/postgresql/data  # データ永続化
```

**起動方法**:
```bash
cd services/telegram-bot
docker compose up -d pgvector
```

### アーキテクチャ（簡素化版）

```
┌─────────────────────────────────────┐
│  コンテンツソース                     │
├─────────────────────────────────────┤
│ - 鍵アカウントのTwitter/X             │
│ - 非公開ブログ（はてな、note等）      │
│ - Mastodon/Bluesky                  │
└─────────────┬───────────────────────┘
              │ OAuth認証で取得
              ↓
┌─────────────────────────────────────┐
│  Knowledge Crawler (新規作成)        │
│  services/knowledge-crawler/        │
├─────────────────────────────────────┤
│ - Twitter OAuth 2.0                │
│ - はてなブログ AtomPub API           │
│ - note RSS/API                      │
│ - ベクトル化 (OpenAI Embeddings)    │
└─────────────┬───────────────────────┘
              │
              ↓ INSERT INTO memory_fragments
┌─────────────────────────────────────┐
│  既存DB (Dockerコンテナ)             │
│  PostgreSQL 17 + pgvector           │
├─────────────────────────────────────┤
│  memory_fragments テーブル (既存)    │
│  - content: TEXT                    │
│  - memory_type: 'long_term'         │
│  - category: 'hobby'/'tech'/etc     │
│  - importance: 1-10                 │
│  - metadata: JSONB ← source情報     │
│  - content_vector_1536              │
│  - HNSW インデックス (既存)         │
└─────────────┬───────────────────────┘
              │
              ↓ ベクトル検索（既存機能）
┌─────────────────────────────────────┐
│  YouTube Bot (Message Handler)      │
├─────────────────────────────────────┤
│ useDrizzle() でDB接続              │
│ ↓                                   │
│ ベクトル検索:                        │
│  WHERE metadata->>'source' = 'twitter' │
│  AND cosine_similarity > 0.75       │
│ ↓                                   │
│ プロンプトに注入 → LLM応答          │
└─────────────────────────────────────┘
```

**重要な変更点**:
- ❌ **削除**: 独自の`knowledge_base`テーブル
- ❌ **削除**: RAG Search Engineパッケージ（既存DBの検索機能で十分）
- ✅ **活用**: 既存の`memory_fragments`テーブル
- ✅ **活用**: 既存のDrizzle ORM
- ✅ **活用**: 既存のベクトルインデックス

### 技術選定（変更なし - 既存インフラを活用）

| コンポーネント | 技術 | 理由 |
|--------------|------|------|
| ベクトルDB | **PostgreSQL 17 + pgvector (既存)** | Dockerコンテナで既に構築済み |
| ORM | **Drizzle ORM (既存)** | スキーマ定義、マイグレーション完備 |
| Embedding | OpenAI Embeddings API | GPU不要、高品質、激安（月1円以下） |
| クローラー | Node.js + OAuth 2.0 | 鍵アカウント・非公開コンテンツに対応 |
| 検索手法 | セマンティック検索（コサイン類似度） | 形態素解析不要、同義語・表記ゆれに強い |

### ベクトル検索の仕組み（既存機能を活用）

```typescript
import { useDrizzle } from '@proj-airi/telegram-bot/db'
import { memoryFragmentsTable } from '@proj-airi/telegram-bot/db/schema'
import { sql } from 'drizzle-orm'

// 1. テキストをベクトル化（OpenAI APIに投げるだけ）
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",  // 1536次元ベクトル
  input: "宝塚では何組が好き？"
})
// → [0.023, -0.891, 0.442, ..., 0.123]

// 2. ベクトル検索（Drizzle ORMで既存テーブルを検索）
const db = useDrizzle()
const results = await db.select({
  content: memoryFragmentsTable.content,
  category: memoryFragmentsTable.category,
  metadata: memoryFragmentsTable.metadata,
  similarity: sql<number>`1 - (content_vector_1536 <=> ${embedding}::vector)`,
})
.from(memoryFragmentsTable)
.where(sql`
  metadata->>'source' IN ('twitter', 'hatena', 'note')
  AND 1 - (content_vector_1536 <=> ${embedding}::vector) > 0.75
`)
.orderBy(sql`content_vector_1536 <=> ${embedding}::vector`)
.limit(5)

// 結果:
// - "花組の芝居が素晴らしい" (0.92) ← "宝塚"という単語なしでもヒット！
// - "雪組のトップスターが好き" (0.89)
// - "タカラジェンヌの歌唱力すごい" (0.87)
```

### 重要ポイント
- ✅ **形態素解析不要**: ベクトル検索は意味的類似性で検索するため
- ✅ **キーワード一致不要**: "宝塚"という単語が含まれていなくてもヒット
- ✅ **同義語・表記ゆれに強い**: "宝塚" "ヅカ" "タカラジェンヌ" すべて意味的に近い
- ✅ **ローカル推論不要**: OpenAI APIに投げるだけ、GPU不要
- ✅ **激安**: 1万文書のベクトル化で約10円、月次更新は1円以下
- ✅ **既存インフラ**: テーブル作成不要、マイグレーション不要

### 実装フェーズ（大幅に簡素化）

```
Phase 1: コンテンツクローラー（1-2週間）
├─ services/knowledge-crawler/ パッケージ作成
├─ Twitter OAuth 2.0 認証（鍵アカウント対応）
├─ はてなブログ AtomPub API 統合
├─ note RSS/API 統合
├─ OpenAI Embeddings API 統合
└─ memory_fragments テーブルへのインサート

Phase 2: YouTube Bot 統合（数時間）
├─ message-handler に既存DB検索を追加
├─ プロンプト構築ロジック
└─ 応答品質調整（閾値、カテゴリフィルタ）

Phase 3: 高度な機能（オプション）
├─ 管理WebUI（知識追加・編集）
└─ 検索分析・ダッシュボード
```

**削除されたフェーズ**:
- ❌ Phase 1（基礎インフラ）→ 既に存在
- ❌ Phase 2（RAG検索エンジン）→ 既存DBで十分
- ❌ Phase 4（A/Bテスト）→ Phase 2に統合

### コスト試算（大幅削減）

```
【初回インデックス化】
- Twitter 5,000ツイート（平均100文字） = 約0.4円
- ブログ 100記事（平均2,000文字） = 約0.15円
- 合計: 約0.5円

【月次運用コスト】
- 新規ツイート 10件/日 × 30日 = 300件 = 約0.07円/月
- 検索時のベクトル化: 100クエリ = 約0.01円
- Embeddings API: 約0.1円/月（誤差レベル）
- 合計: 約0.1円/月

【PostgreSQL】
- Dockerコンテナ (既存): 0円
- S3バックアップ: 約3円/月（10MB × 4週）

【削減されたコスト】
- ❌ RDS料金: 2,200円/月 → 0円
- ❌ 新規インフラ構築: 不要

合計: 約3円/月
```

### データベースバックアップ戦略

#### 推奨: `make db-backup` + AWS S3

**Makefile** (`Makefile` または `services/telegram-bot/Makefile`):
```makefile
.PHONY: db-backup db-backup-s3 db-restore db-list-backups

# ローカルバックアップ
db-backup:
	@echo "💾 Creating database backup..."
	@mkdir -p backups
	@docker exec telegram-bot-pgvector-1 pg_dump -U postgres postgres | \
		gzip > backups/db-$(shell date +%Y%m%d-%H%M%S).sql.gz
	@echo "✅ Backup saved to backups/"

# S3にアップロード
db-backup-s3: db-backup
	@echo "📤 Uploading to S3..."
	@aws s3 cp backups/$$(ls -t backups/ | head -1) \
		s3://your-bucket-name/airi-backups/
	@echo "✅ Uploaded to S3"

# S3からダウンロードして復元
db-restore:
	@echo "📥 Available backups in S3:"
	@aws s3 ls s3://your-bucket-name/airi-backups/
	@read -p "Enter backup filename: " file; \
	aws s3 cp s3://your-bucket-name/airi-backups/$$file - | \
	gunzip | docker exec -i telegram-bot-pgvector-1 psql -U postgres postgres
	@echo "✅ Database restored"

# バックアップ一覧
db-list-backups:
	@echo "📂 Local backups:"
	@ls -lh backups/ 2>/dev/null || echo "No local backups"
	@echo ""
	@echo "☁️  S3 backups:"
	@aws s3 ls s3://your-bucket-name/airi-backups/
```

**使い方**:
```bash
# 配信後やデータ更新後に実行
make db-backup-s3

# 復元が必要な時
make db-restore
```

**コスト**:
- S3ストレージ: 10MB × 4週 = 40MB → 約3円/月
- S3 PUT/GET: 週1回 → ほぼ無料
- **合計**: 約3円/月

**メリット**:
- ✅ 99.999999999% の耐久性（S3）
- ✅ いつでもどこでも復元可能
- ✅ 手動実行のみ（配信前/後に1回）
- ✅ 暗号化オプション（環境変数で管理）

#### バックアップ不要論（SNS復元戦略）

ソーシャルメディアからの完全復元が可能なため、通常のバックアップは不要とも言えます：

```bash
# 災害復旧シナリオ: DB完全消失

# 1. Dockerコンテナ再起動
cd services/telegram-bot
docker compose up -d pgvector

# 2. 全データ復元（自動）
pnpm knowledge:restore-all

# 実行内容:
# - Twitter OAuth認証
# - 全ツイート取得（5,000件）
# - ベクトル化してインサート（OpenAI Embeddings API）
# - はてなブログ等も同様に処理
#
# 所要時間: 約10-15分
# コスト: 約0.5円
```

**ハイブリッド戦略**（推奨）:
1. **平常時**: 何もしない
2. **大きな更新後**: `make db-backup-s3`（念のため）
3. **災害時**: `pnpm knowledge:restore-all`（10分で復元）
4. **緊急時**: S3から即座に復元（数分）

### メリット

#### 1. パーソナライゼーション
- ユーザーの実際の考え・趣味・知識を反映
- 一貫性のある応答（「昔はこう言ってたけど今は違う」問題を回避）

#### 2. 自動更新
- 鍵アカウントのTwitter/ブログから自動同期
- 手動INSERT不要
- 時系列で考えの変化も追跡可能

#### 3. プライバシー保護
- 鍵アカウント・非公開ブログから取得
- DB内に安全に保管
- 外部に漏れない

#### 4. 拡張性
- 新しいソースを簡単に追加可能（Bluesky、Misskey等）
- カテゴリやタグでフィルタリング
- ハイブリッド検索などの高度な機能に拡張可能

#### 5. 低コスト
- Embeddings APIは誤差レベル（月0.1円）
- GPUサーバー不要

### 技術的課題と解決策

| 課題 | 解決策 |
|------|--------|
| 検索精度の調整 | 閾値（minSimilarity）の調整、カテゴリフィルタ、top-kの最適化 |
| 古い情報の扱い | 時系列フィルタ、最新情報に重み付け、定期的なリインデックス |
| コンテキスト長制限 | 検索結果を要約、最も関連性の高いもののみ選択 |
| リアルタイム性 | 配信開始時の手動更新が最適 |
| 重複コンテンツ | ハッシュベースの重複除去、類似度による統合 |

### 参考実装

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

### 実運用での更新戦略

配信開始時の手動更新が最適です：

```bash
# 配信開始時（推奨フロー）
make stream

# 実行内容:
# 1. 知識ベース更新（差分のみ、1-2分）
# 2. 統計表示で確認
# 3. YouTube Bot 自動起動
```

**メリット**:
- ✅ 最もシンプル（cronやsystemd timer不要）
- ✅ 確実性（配信前に最新データを確認）
- ✅ トラブル回避（更新エラーを配信前に検知）

## LLMモデルのランダム選択機能

### 背景と目的

配信中の応答に多様性を持たせるため、複数のLLMモデルからリクエストごとにランダム選択する機能。

**目的:**
- 応答の多様性を確保（同じ質問でも異なる言い回し）
- 配信の暗転を避けつつモデルを切り替え
- 各モデルの特性を活かした自然なバリエーション

### 技術的アプローチ

#### 実装方針: リクエストごとのランダム選択

```typescript
// utils/llm-model-selector.ts（新規作成）

/**
 * Select a random LLM model from comma-separated list in VITE_LLM_MODEL
 *
 * @example
 * // .env:
 * // VITE_LLM_MODEL=anthropic/claude-4.5-sonnet,anthropic/claude-3.5-sonnet,google/gemini-2.0-flash-exp
 *
 * const model = selectRandomModel()
 * // Returns: "anthropic/claude-3.5-sonnet" (random)
 */
export function selectRandomModel(): string {
  const modelEnv = import.meta.env.VITE_LLM_MODEL || ''
  const models = modelEnv.split(',').map(m => m.trim()).filter(m => m.length > 0)

  if (models.length === 0) {
    console.warn('[LLM] No models configured in VITE_LLM_MODEL')
    return ''
  }

  if (models.length === 1) {
    return models[0]
  }

  const selectedModel = models[Math.floor(Math.random() * models.length)]
  console.info(`[LLM] Selected model: ${selectedModel} from ${models.length} options`)
  return selectedModel
}
```

### 環境変数の設定

```bash
# apps/stage-web/.env

# カンマ区切りで複数のモデルを指定
VITE_LLM_MODEL=anthropic/claude-4.5-sonnet,anthropic/claude-3.5-sonnet,google/gemini-2.0-flash-exp

# または単一モデル（後方互換性）
VITE_LLM_MODEL=anthropic/claude-4.5-sonnet
```

### 修正対象ファイル

1. **apps/stage-web/src/utils/llm-model-selector.ts** (新規作成)
   - `selectRandomModel()` 関数の実装

2. **apps/stage-web/src/composables/websocket-client.ts:60**
   ```typescript
   // 変更前:
   const llmModel = import.meta.env.VITE_LLM_MODEL

   // 変更後:
   const llmModel = selectRandomModel()
   ```

3. **apps/stage-web/src/composables/idle-talk.ts** (該当箇所)
   - アイドルトークでもランダムモデル選択を適用

4. **apps/stage-web/src/App.vue:81** (初期設定)
   ```typescript
   // 初回マウント時は最初のモデルを使用（または同様にランダム選択）
   const modelList = import.meta.env.VITE_LLM_MODEL.split(',')
   const llmModel = modelList[0]?.trim() || ''
   ```

### メリット

1. **リロード不要**: 配信中断なしで常にモデルを切り替え
2. **多様性**: 各応答で異なるモデルを使用可能
3. **柔軟性**: 環境変数だけで簡単に設定変更
4. **後方互換性**: 単一モデル指定でも動作
5. **キャラクター性維持**: 同じsystem promptを使用するため一貫性は保たれる

### デメリットと対応

| デメリット | 対応 |
|----------|------|
| 会話の一貫性がやや低下 | 各モデルは同じsystem promptを受け取るためキャラクター性は維持される |
| モデルごとに応答速度が異なる | 遅いモデルは除外するか、タイムアウト設定を調整 |
| コスト変動 | 安価なモデルを中心に構成、高コストモデルは最小限に |

### 将来的な拡張案（オプション）

#### 1. 重み付けランダム選択

特定のモデルを優先しつつランダム性を持たせる：

```bash
# 構文例: model:weight
VITE_LLM_MODEL=anthropic/claude-4.5-sonnet:3,anthropic/claude-3.5-sonnet:2,google/gemini-2.0-flash-exp:1
```

```typescript
export function selectWeightedRandomModel(): string {
  const modelEnv = import.meta.env.VITE_LLM_MODEL || ''
  const entries = modelEnv.split(',').map(entry => {
    const [model, weight] = entry.split(':')
    return { model: model.trim(), weight: Number(weight?.trim() || 1) }
  })

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  let random = Math.random() * totalWeight

  for (const entry of entries) {
    random -= entry.weight
    if (random <= 0) return entry.model
  }

  return entries[0].model
}
```

#### 2. 選択戦略の設定

```bash
VITE_LLM_MODEL_SELECTION_STRATEGY=random  # random | sequential | weighted
```

- `random`: 完全ランダム（推奨）
- `sequential`: 順番に使用（テスト・デバッグ用）
- `weighted`: 重み付けランダム

#### 3. モデル統計の記録

```typescript
// どのモデルが何回使われたか、応答時間の平均などを記録
export interface ModelStats {
  model: string
  usageCount: number
  avgResponseTime: number
  errorCount: number
}
```

### 実装優先度

- **Priority**: Low-Medium
- **Effort**: Small (1-2時間)
- **Impact**: Medium (配信の多様性向上)
- **Status**: 設計完了、実装待ち

### 関連Issue/PR

- 実装時に作成

---

## 参考資料

- [PostgreSQL pgvector](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [RAG (Retrieval-Augmented Generation)](https://arxiv.org/abs/2005.11401)
- [LangChain](https://python.langchain.com/docs/use_cases/question_answering/)
- [LlamaIndex](https://docs.llamaindex.ai/)

## 設定ファイルの一元管理システム

### 背景と課題

現在、設定ファイルが複数のサービスに分散しており、管理が煩雑になっています：

```
現状の設定ファイル配置:
├── apps/stage-web/.env                          # stage-web環境変数
├── apps/stage-web/public/prompts/
│   └── system-prompt.md                         # システムプロンプト
├── services/knowledge-db/.env                   # knowledge-db環境変数
└── services/youtube-bot/.env                    # youtube-bot環境変数
```

**問題点:**
- 設定が分散しているため、全体を把握しづらい
- 各サービスごとに個別に設定ファイルを編集する必要がある
- 設定の同期漏れや不整合が発生しやすい
- 新しい開発者のオンボーディングが困難

### 提案：設定の一元管理とシンク機構

```
提案する構成:
airi-youtube-live/
├── config/                                      # 設定の一元管理ディレクトリ
│   ├── README.md                                # 設定管理ガイド
│   ├── prompts/
│   │   └── system-prompt.md                     # マスターのシステムプロンプト
│   ├── env/
│   │   ├── stage-web.env                        # stage-web用環境変数テンプレート
│   │   ├── knowledge-db.env                     # knowledge-db用環境変数テンプレート
│   │   └── youtube-bot.env                      # youtube-bot用環境変数テンプレート
│   ├── sync-config.sh                           # 設定同期スクリプト
│   └── validate-config.sh                       # 設定バリデーションスクリプト
└── ...
```

### sync-config.sh の設計

#### 主な機能

1. **設定の同期**
   - `config/` ディレクトリから各サービスへ設定をコピー
   - プロンプトファイルも自動配置

2. **バックアップ**
   - 既存の設定ファイルを `.backup/` に保存
   - タイムスタンプ付きでバックアップ管理

3. **差分表示**
   - 変更内容を視覚的に表示
   - 意図しない変更を事前に確認

4. **バリデーション**
   - 必須環境変数のチェック
   - ファイルパスの存在確認
   - フォーマットの妥当性検証

#### 使用例

```bash
# 設定の同期（ドライラン）
./config/sync-config.sh --dry-run

# 設定の同期（実行）
./config/sync-config.sh

# 差分のみ表示
./config/sync-config.sh --diff

# バックアップから復元
./config/sync-config.sh --restore
```

#### スクリプト実装の概要

```bash
#!/bin/bash
# config/sync-config.sh

set -euo pipefail

CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$CONFIG_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.config-backups/$(date +%Y%m%d-%H%M%S)"

# 同期マッピング定義
declare -A SYNC_MAP=(
    ["$CONFIG_DIR/env/stage-web.env"]="$PROJECT_ROOT/apps/stage-web/.env"
    ["$CONFIG_DIR/env/knowledge-db.env"]="$PROJECT_ROOT/services/knowledge-db/.env"
    ["$CONFIG_DIR/env/youtube-bot.env"]="$PROJECT_ROOT/services/youtube-bot/.env"
    ["$CONFIG_DIR/prompts/system-prompt.md"]="$PROJECT_ROOT/apps/stage-web/public/prompts/system-prompt.md"
)

# バックアップ作成
create_backup() {
    echo "📦 Creating backup in $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    for src in "${!SYNC_MAP[@]}"; do
        dest="${SYNC_MAP[$src]}"
        if [[ -f "$dest" ]]; then
            cp "$dest" "$BACKUP_DIR/$(basename "$dest")"
        fi
    done
}

# 差分表示
show_diff() {
    for src in "${!SYNC_MAP[@]}"; do
        dest="${SYNC_MAP[$src]}"
        if [[ -f "$dest" ]]; then
            echo "📄 Changes in $(basename "$dest"):"
            diff -u "$dest" "$src" || true
            echo ""
        fi
    done
}

# 同期実行
sync_configs() {
    for src in "${!SYNC_MAP[@]}"; do
        dest="${SYNC_MAP[$src]}"
        echo "📋 Syncing $(basename "$src") → $dest"

        # ディレクトリ作成
        mkdir -p "$(dirname "$dest")"

        # ファイルコピー
        cp "$src" "$dest"
    done

    echo "✅ Configuration sync completed"
}

# バリデーション
validate_configs() {
    echo "🔍 Validating configurations..."

    # 必須環境変数チェック
    for env_file in "$CONFIG_DIR/env"/*.env; do
        echo "Checking $(basename "$env_file")..."
        # ここに具体的なバリデーションロジック
    done

    echo "✅ Validation passed"
}

# メイン処理
case "${1:-}" in
    --dry-run)
        show_diff
        ;;
    --diff)
        show_diff
        ;;
    --restore)
        # 最新のバックアップから復元
        latest_backup=$(ls -td $PROJECT_ROOT/.config-backups/* | head -1)
        echo "🔄 Restoring from $latest_backup"
        # 復元ロジック
        ;;
    --validate)
        validate_configs
        ;;
    *)
        create_backup
        validate_configs
        sync_configs
        ;;
esac
```

### Makefile統合

```makefile
# プロジェクトルートのMakefile

.PHONY: config-sync config-diff config-validate config-restore

# 設定の同期
config-sync:
	@./config/sync-config.sh

# 差分確認
config-diff:
	@./config/sync-config.sh --diff

# バリデーション
config-validate:
	@./config/sync-config.sh --validate

# バックアップから復元
config-restore:
	@./config/sync-config.sh --restore
```

### メリット

1. **一元管理**: すべての設定を `config/` で管理
2. **安全性**: バックアップ機能で誤操作を防止
3. **可視性**: 差分表示で変更内容を確認
4. **バリデーション**: 設定ミスを事前に検出
5. **再現性**: 設定を簡単に複製・共有可能
6. **ドキュメント化**: `config/README.md` で設定ガイドを提供

### デメリットと対策

| デメリット | 対策 |
|----------|------|
| 設定の二重管理 | スクリプト実行を習慣化、pre-commit hookで自動チェック |
| 同期忘れ | CI/CDで自動バリデーション、Makefileで簡単実行 |
| 秘密情報の扱い | `.env.example`をテンプレート化、実際の値は`.env`のみ |

### 実装優先度

- **Priority**: Medium
- **Effort**: Small (2-4時間)
- **Impact**: Medium (開発効率向上)
- **Status**: 設計完了、実装待ち

### 関連Issue/PR

- 実装時に作成

---

**最終更新**: 2025-10-17
**ステータス**: 設計完了
**実装見積もり**: 2-4時間
