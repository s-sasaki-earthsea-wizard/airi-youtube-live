# Knowledge Database Service for AIRI

A dedicated service for managing AIRI's character knowledge database. Collects and stores information from external services (Twitter, note.com, etc.) using PostgreSQL with pgvector for semantic search.

## Features

- ✅ PostgreSQL + pgvector for vector similarity search
- ✅ Drizzle ORM for type-safe database operations
- ✅ REST API for knowledge queries
- ✅ Data collectors for external services (Twitter, note.com)
- ✅ Vector embeddings support for RAG (Retrieval-Augmented Generation)

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
# - External service API keys (Twitter, note, etc.)
# - Embedding service configuration
```

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
```bash
GET http://localhost:3100/knowledge?query=your_query&limit=10
```

### Data Collection

#### Collect from Twitter
```bash
pnpm collect:twitter
```

#### Collect from note.com
```bash
pnpm collect:note
```

**Note**: Twitter and note.com collectors are placeholder implementations. You'll need to:
1. Configure API keys in `.env`
2. Implement actual API integration in `src/collectors/`
3. Add embedding generation for vector search

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

### youtube-bot

The youtube-bot can query this knowledge database to enhance system prompts with relevant character knowledge:

```typescript
// In youtube-bot
const response = await fetch('http://localhost:3100/knowledge?query=user_message')
const { results } = await response.json()

// Inject knowledge into system prompt
const systemPrompt = `${basePrompt}\n\nRelevant knowledge:\n${results.map(r => r.content).join('\n')}`
```

### stage-web

stage-web can also query the knowledge API directly for standalone mode.

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

- [ ] Implement Twitter API v2 integration
- [ ] Implement note.com web scraping/API
- [ ] Add embedding generation (OpenAI/local models)
- [ ] Implement vector similarity search
- [ ] Add authentication for API endpoints
- [ ] Create scheduled data sync (cron jobs)
- [ ] Add data deduplication logic
- [ ] Implement incremental updates
- [ ] Add monitoring and logging

## Architecture

```
External Services (Twitter, note, etc.)
  ↓ Data Collection
PostgreSQL + pgvector
  ↓ REST API
youtube-bot / stage-web
  ↓ RAG (Retrieval-Augmented Generation)
LLM System Prompt
```

## License

MIT
