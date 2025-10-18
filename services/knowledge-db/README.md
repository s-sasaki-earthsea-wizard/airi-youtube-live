# Knowledge Database Service for AIRI

A dedicated service for managing AIRI's character knowledge database. Collects and stores information from external services (Twitter, note.com, etc.) using PostgreSQL with pgvector for semantic search.

## Features

- ✅ PostgreSQL + pgvector for vector similarity search
- ✅ Drizzle ORM for type-safe database operations
- ✅ REST API for knowledge queries
- ✅ Discord message collector with real-time vectorization
- ✅ OpenAI Embeddings API integration (@xsai/embed)
- ✅ Vector embeddings support for RAG (Retrieval-Augmented Generation)
- ✅ Automatic duplicate prevention (UPSERT by source + external_id)

## Prerequisites

- Docker & Docker Compose
- Node.js 23+
- pnpm

## Setup

### 1. Install Dependencies

From the AIRI root directory:

```bash
pnpm install
```

### 2. Configure Environment Variables

```bash
cd services/knowledge-db
cp .env.example .env

# Edit .env and configure:
# - Database credentials
# - API server port
# - Discord bot token and channel ID
# - Embedding service configuration (OpenAI API)
```

**Required environment variables:**
- `DISCORD_BOT_TOKEN`: Discord bot token from Developer Portal
- `DISCORD_CHANNEL_ID`: Target Discord channel ID for message collection
- `EMBEDDING_API_KEY`: OpenAI API key for vectorization
- `EMBEDDING_MODEL`: Model name (default: `text-embedding-3-small`)
- `EMBEDDING_DIMENSION`: Vector dimension (1536/1024/768)

### 3. Start Database

```bash
docker-compose up -d
```

This will start PostgreSQL with pgvector extension on port 5434.

### 4. Initialize Database Schema

```bash
pnpm db:generate  # Generate Drizzle migrations
pnpm db:push      # Apply schema to database
```

## Usage

### Start API Server

```bash
pnpm start        # Production mode
pnpm dev          # Development mode with auto-reload
```

The API server will be available at `http://localhost:3100`.

### API Endpoints

#### Health Check
```bash
GET http://localhost:3100/health
```

#### Get All Posts
```bash
GET http://localhost:3100/posts
```

#### Get Posts by Source
```bash
GET http://localhost:3100/posts/source/twitter
GET http://localhost:3100/posts/source/note
```

#### Knowledge Query (RAG Integration)

Semantic search using vector similarity:

```bash
GET http://localhost:3100/knowledge?query=好きな作家は誰ですか？&limit=10&threshold=0.3
```

**Parameters:**
- `query` (required): Search query text
- `limit` (optional, default: 10): Maximum number of results
- `threshold` (optional, default: 0.3): Minimum similarity score (0-1)

**Response:**
```json
{
  "query": "好きな作家は誰ですか？",
  "results": [
    {
      "id": "uuid",
      "source": "discord",
      "author": "megssk",
      "content": "わたしが好きな作家はアーシュラ・ル＝グウィン...",
      "url": "https://discord.com/channels/...",
      "posted_at": 1234567890,
      "similarity": 0.5380
    }
  ],
  "total": 1
}
```

The endpoint automatically:
1. Generates embeddings for the query using OpenAI API
2. Performs cosine similarity search against stored vectors
3. Returns results sorted by similarity score

#### Random Posts (for Idle Talk Feature)

Get random posts without similarity search:

```bash
GET http://localhost:3100/knowledge/random?limit=5
```

**Parameters:**
- `limit` (optional, default: 5): Maximum number of random posts to return
- `source` (optional): Filter by source (e.g., 'discord', 'twitter')

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "source": "discord",
      "author": "megssk",
      "content": "なんかの認証をするときに汚い背景に書かれてる文字を読んだり...",
      "url": "https://discord.com/channels/...",
      "posted_at": 1234567890
    }
  ],
  "total": 5
}
```

**Use Case:**
This endpoint is designed for the idle talk feature in stage-web, where the AI character spontaneously talks about random topics from the knowledge database when there is no user input.

### Data Collection

#### Collect from Discord

Start Discord message collector (monitors channel and collects new messages):

```bash
pnpm collect:discord
```

**Features:**
- Fetches historical messages (default: all available messages using pagination)
- Real-time monitoring for new messages
- Automatic vectorization using OpenAI Embeddings API
- Duplicate prevention (UPSERT by Discord message ID)
- Skips empty messages and bot messages
- Configurable message limit via `DISCORD_HISTORICAL_LIMIT` environment variable

**Discord Bot Setup:**
1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable "MESSAGE CONTENT INTENT" in Bot settings
3. Invite bot to server with permissions: 66560 (View Channels + Read Message History)
4. Copy bot token and channel ID to `.env`

### Testing Similarity Threshold

Test script to evaluate appropriate similarity threshold for your data:

```bash
pnpm test:similarity
```

This script tests various query types (exact matches, related topics, peripheral topics, unrelated queries) against your knowledge database and provides statistics to help you choose the optimal threshold value.

**Example output:**
- Complete matches: avg 0.47 (min 0.39, max 0.54)
- Related topics: avg 0.44 (min 0.31, max 0.50)
- Peripheral topics: avg 0.43 (min 0.37, max 0.54)
- Unrelated queries: avg 0.31 (min 0.19, max 0.38)

Based on testing, **threshold 0.3-0.4** is recommended for balanced RAG integration.

### Makefile Commands

From the project root directory:

```bash
# Complete setup (first time only)
make db-setup

# Start knowledge-db service (DB + API server)
make db-start

# Sync Discord messages (stop collector → stop DB → start DB → start collector)
make db-sync-discord              # Sync all Discord messages (default)
make db-sync-discord LIMIT=100    # Sync only last 100 messages

# Start Discord collector (runs in background)
make collect-discord

# Stop Discord collector
make collect-discord-stop

# Restart Discord collector
make collect-discord-restart

# Restart knowledge-db API server (without restarting DB)
make db-restart

# Export database to JSON
make db-export

# ⚠️ Delete all records (dangerous, requires confirmation)
make db-danger-clear-all

# Check service status
make db-status

# Stop knowledge-db service
make db-stop
```

**Note**:

- `make collect-discord` and `make db-sync-discord` run the Discord collector in background
- Check collector logs: `tail -f /tmp/discord-collector.log`
- The collector automatically fetches all available historical messages on startup (using pagination)
- Limit historical messages with `DISCORD_HISTORICAL_LIMIT` environment variable if needed
- New messages are collected in real-time and automatically vectorized

## Database Schema

### Tables

- **posts**: Stores content from external services
  - `id`: UUID primary key
  - `source`: Service name (twitter, note, etc.)
  - `external_id`: External service post ID
  - `author`: Post author
  - `content`: Post text content
  - `url`: Original post URL
  - `posted_at`: Original post timestamp
  - `content_vector_*`: Vector embeddings for semantic search

- **tags**: Post categorization tags
- **post_tags**: Many-to-many relationship between posts and tags
- **metadata**: System metadata (last sync times, API tokens, etc.)

## Integration with Other Services

### stage-web (Integrated)

stage-web integrates with knowledge-db through the `useKnowledgeDB` composable and `onBeforeMessageComposed` hook.

**Configuration** (`.env`):

```env
VITE_KNOWLEDGE_DB_ENABLED=true
VITE_KNOWLEDGE_DB_URL=http://localhost:3100
VITE_KNOWLEDGE_DB_LIMIT=3
VITE_KNOWLEDGE_DB_THRESHOLD=0.3
```

**Integration Flow**:

1. User sends message in stage-web
2. `onBeforeMessageComposed` hook triggers
3. `useKnowledgeDB.queryKnowledge(userMessage)` queries knowledge-db API
4. Relevant results (top 3, similarity >= 0.5) are formatted
5. System prompt is dynamically updated with knowledge context
6. LLM generates response with character knowledge

**Files**:

- `apps/stage-web/src/composables/useKnowledgeDB.ts` - Knowledge DB composable
- `apps/stage-web/src/App.vue` - Hook registration in `onMounted()`

**Idle Talk Feature**:
stage-web also includes an idle talk feature that automatically starts conversations when there is no user input for a specified time. It uses the `/knowledge/random` endpoint to select random topics from the knowledge database.

**Configuration** (`.env`):

```env
VITE_IDLE_TALK_ENABLED=true
VITE_IDLE_TIMEOUT=60000  # 60 seconds
VITE_IDLE_TALK_MODE=random
```

**Integration Flow**:

1. Timer monitors user inactivity
2. After timeout, `useKnowledgeDB.getRandomTopic()` fetches 5 random posts
3. One topic is randomly selected
4. LLM generates a response based on the topic
5. TTS converts response to speech and plays audio
6. Timer resets for next iteration

**Files**:

- `apps/stage-web/src/composables/idle-talk.ts` - Idle talk feature implementation
- `apps/stage-web/src/composables/useKnowledgeDB.ts` - `getRandomTopic()` method

### youtube-bot (Not Yet Integrated)

The youtube-bot can query this knowledge database to enhance system prompts with relevant character knowledge:

```typescript
// In youtube-bot
const response = await fetch('http://localhost:3100/knowledge?query=user_message')
const { results } = await response.json()

// Inject knowledge into system prompt
const systemPrompt = `${basePrompt}\n\nRelevant knowledge:\n${results.map(r => r.content).join('\n')}`
```

## Database Management

### View Database in Browser

```bash
pnpm db:studio
```

Opens Drizzle Studio at `http://localhost:4983`.

### Stop Database

```bash
docker-compose down
```

### Reset Database (⚠️ Deletes all data)

```bash
docker-compose down -v
docker-compose up -d
pnpm db:push
```

## Development Roadmap

- [x] Discord message collector
- [x] Real-time vectorization with OpenAI Embeddings
- [x] Duplicate prevention (UPSERT logic)
- [x] Vector similarity search endpoint with cosine distance
- [ ] Implement Twitter API v2 integration
- [ ] Implement note.com web scraping/API
- [ ] Add authentication for API endpoints
- [ ] Create scheduled data sync (cron jobs)
- [ ] Add response caching for knowledge queries
- [ ] Add monitoring and logging

## Architecture

```text
Discord Channel
  ↓ Discord Bot (collect:discord)
  ↓ Real-time Vectorization (OpenAI Embeddings API)
PostgreSQL + pgvector
  ↓ REST API (port 3100)
youtube-bot / stage-web
  ↓ RAG (Retrieval-Augmented Generation)
LLM System Prompt
```

## Vector Search Example

Query similar posts using cosine distance:

```sql
SELECT id, author, content,
       1 - (content_vector_1536 <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM posts
WHERE source = 'discord'
ORDER BY content_vector_1536 <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

Using Drizzle ORM:

```typescript
import { sql } from 'drizzle-orm'
import { db } from './db/client'
import { postsTable } from './db/schema'

const queryVector = [0.1, 0.2, ...] // 1536 dimensions

const results = await db
  .select({
    id: postsTable.id,
    content: postsTable.content,
    similarity: sql<number>`1 - (${postsTable.content_vector_1536} <=> ${queryVector}::vector)`,
  })
  .from(postsTable)
  .orderBy(sql`${postsTable.content_vector_1536} <=> ${queryVector}::vector`)
  .limit(5)
```

## License

MIT
