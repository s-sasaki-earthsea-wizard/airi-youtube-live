import { env } from 'node:process'

import express from 'express'

import { embed } from '@xsai/embed'
import { sql } from 'drizzle-orm'

import { db } from './db/client.js'
import { postsTable } from './db/schema.js'

import 'dotenv/config'

const app = express()
const PORT = env.PORT || 3100
const HOST = env.HOST || '0.0.0.0'

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})

app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'knowledge-db' })
})

// Get all posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await db.select().from(postsTable).limit(100)
    res.json({ posts })
  }
  catch (error) {
    console.error('Error fetching posts:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// Get posts by source
app.get('/posts/source/:source', async (req, res) => {
  try {
    const { source } = req.params
    const posts = await db
      .select()
      .from(postsTable)
      .where((t, { eq }) => eq(t.source, source))
      .limit(100)
    res.json({ posts })
  }
  catch (error) {
    console.error('Error fetching posts by source:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// Knowledge query endpoint (for RAG integration)
app.get('/knowledge', async (req, res) => {
  try {
    const { query, limit = 10, threshold = 0.3 } = req.query

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' })
    }

    // Generate embedding for the query
    const embeddingResult = await embed({
      baseURL: env.EMBEDDING_API_BASE_URL!,
      apiKey: env.EMBEDDING_API_KEY!,
      model: env.EMBEDDING_MODEL!,
      input: query,
    })

    const queryVector = embeddingResult.embedding
    const vectorString = `[${queryVector.join(',')}]`

    // Perform vector similarity search using cosine distance
    // cosine distance operator: <=> (lower is more similar)
    // similarity = 1 - distance
    const results = await db
      .select({
        id: postsTable.id,
        source: postsTable.source,
        author: postsTable.author,
        content: postsTable.content,
        url: postsTable.url,
        posted_at: postsTable.posted_at,
        similarity: sql<number>`1 - (${postsTable.content_vector_1536} <=> ${vectorString}::vector)`,
      })
      .from(postsTable)
      .where(sql`${postsTable.content_vector_1536} IS NOT NULL`)
      .orderBy(sql`${postsTable.content_vector_1536} <=> ${vectorString}::vector`)
      .limit(Number(limit))

    // Filter by similarity threshold
    const filteredResults = results.filter(r => r.similarity >= Number(threshold))

    res.json({
      query,
      results: filteredResults,
      total: filteredResults.length,
    })
  }
  catch (error) {
    console.error('Error in knowledge query:', error)
    res.status(500).json({ error: 'Failed to query knowledge base' })
  }
})

// Get random posts endpoint (for idle talk feature)
app.get('/knowledge/random', async (req, res) => {
  try {
    const { limit = 5, source: _source } = req.query

    // Build query with optional source filter
    const query = db
      .select({
        id: postsTable.id,
        source: postsTable.source,
        author: postsTable.author,
        content: postsTable.content,
        url: postsTable.url,
        posted_at: postsTable.posted_at,
      })
      .from(postsTable)
      .where(sql`${postsTable.content_vector_1536} IS NOT NULL`)
      .orderBy(sql`RANDOM()`)
      .limit(Number(limit))

    const posts = await query

    res.json({
      posts,
      total: posts.length,
    })
  }
  catch (error) {
    console.error('Error fetching random posts:', error)
    res.status(500).json({ error: 'Failed to fetch random posts' })
  }
})

app.listen(PORT, HOST, () => {
  console.info(`[knowledge-db] Server running at http://${HOST}:${PORT}`)
  console.info('[knowledge-db] Health check: http://localhost:3100/health')
  console.info('[knowledge-db] Posts endpoint: http://localhost:3100/posts')
  console.info('[knowledge-db] Knowledge query: http://localhost:3100/knowledge?query=xxx')
  console.info('[knowledge-db] Random posts: http://localhost:3100/knowledge/random?limit=5')
})
