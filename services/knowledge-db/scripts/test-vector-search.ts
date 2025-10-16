import process from 'node:process'

import { embed } from '@xsai/embed'
import { sql } from 'drizzle-orm'

import { db } from '../src/db/client.js'
import { postsTable } from '../src/db/schema.js'

async function main() {
  const query = '好きな作家は誰ですか？'

  console.info(`Query: ${query}`)
  console.info('Generating embedding...')

  // Generate embedding for the query
  const embeddingResult = await embed({
    baseURL: process.env.EMBEDDING_API_BASE_URL!,
    apiKey: process.env.EMBEDDING_API_KEY!,
    model: process.env.EMBEDDING_MODEL!,
    input: query,
  })

  const queryVector = embeddingResult.embedding
  const vectorString = `[${queryVector.join(',')}]`
  console.info(`Embedding generated (${queryVector.length} dimensions)`)

  // Perform vector similarity search
  const results = await db
    .select({
      id: postsTable.id,
      source: postsTable.source,
      author: postsTable.author,
      content: postsTable.content,
      similarity: sql<number>`1 - (${postsTable.content_vector_1536} <=> ${vectorString}::vector)`,
    })
    .from(postsTable)
    .where(sql`${postsTable.content_vector_1536} IS NOT NULL`)
    .orderBy(sql`${postsTable.content_vector_1536} <=> ${vectorString}::vector`)
    .limit(3)

  console.info(`\nTop 3 results:`)
  for (const result of results) {
    console.info(`\n[${result.similarity.toFixed(4)}] ${result.author}:`)
    console.info(result.content.substring(0, 100))
  }
}

main().catch(console.error).finally(() => process.exit(0))
