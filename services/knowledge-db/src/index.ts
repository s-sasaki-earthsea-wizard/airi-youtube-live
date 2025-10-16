import { env } from 'node:process'

import express from 'express'

import { db } from './db/client.js'
import { postsTable } from './db/schema.js'

import 'dotenv/config'

const app = express()
const PORT = env.PORT || 3100
const HOST = env.HOST || '0.0.0.0'

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
// This will be enhanced with vector search later
app.get('/knowledge', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' })
    }

    // TODO: Implement vector similarity search
    // For now, return recent posts as placeholder
    const posts = await db
      .select()
      .from(postsTable)
      .orderBy((t, { desc }) => desc(t.posted_at))
      .limit(Number(limit))

    res.json({
      query,
      results: posts,
    })
  }
  catch (error) {
    console.error('Error in knowledge query:', error)
    res.status(500).json({ error: 'Failed to query knowledge base' })
  }
})

app.listen(PORT, HOST, () => {
  console.info(`[knowledge-db] Server running at http://${HOST}:${PORT}`)
  console.info('[knowledge-db] Health check: http://localhost:3100/health')
  console.info('[knowledge-db] Posts endpoint: http://localhost:3100/posts')
  console.info('[knowledge-db] Knowledge query: http://localhost:3100/knowledge?query=xxx')
})
