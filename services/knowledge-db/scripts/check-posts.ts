import process from 'node:process'

import { eq, sql } from 'drizzle-orm'

import { db } from '../src/db/client.js'
import { postsTable } from '../src/db/schema.js'

async function main() {
  // Count total posts
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(postsTable)
  console.info(`Total posts: ${totalResult[0].count}`)

  // Count Discord posts with vectors
  const discordResult = await db
    .select({
      total: sql<number>`count(*)`,
      with_vector: sql<number>`count(${postsTable.content_vector_1536})`,
    })
    .from(postsTable)
    .where(eq(postsTable.source, 'discord'))

  console.info(`Discord posts: ${discordResult[0].total}`)
  console.info(`With vector: ${discordResult[0].with_vector}`)

  // Show first 5 Discord posts
  const posts = await db
    .select({
      id: postsTable.id,
      external_id: postsTable.external_id,
      author: postsTable.author,
      content: postsTable.content,
    })
    .from(postsTable)
    .where(eq(postsTable.source, 'discord'))
    .limit(5)

  console.info('\nFirst 5 Discord posts:')
  for (const post of posts) {
    console.info(`- ${post.author}: ${post.content.substring(0, 60)}...`)
  }
}

main().catch(console.error).finally(() => process.exit(0))
