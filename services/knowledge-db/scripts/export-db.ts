/**
 * Export knowledge database to JSON file
 *
 * This script exports all posts from the knowledge database to a JSON file.
 * For privacy protection, only public-safe fields are included:
 * - content: The actual post content
 * - source: Platform name (discord, twitter, etc.)
 * - posted_date: Date only (no time for additional privacy)
 *
 * Excluded fields (privacy protection):
 * - author: User names/handles
 * - url: Direct links to original posts
 * - external_id: Platform-specific IDs
 *
 * Usage:
 *   pnpm run export:db [output-file]
 *   make db-export
 *
 * Output file defaults to: ../../exports/knowledge-db-{timestamp}.json (project root)
 */

import process from 'node:process'

import { writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { db } from '../src/db/client.js'
import { postsTable } from '../src/db/schema.js'

async function main() {
  // Default output to project root's exports directory
  const defaultOutput = resolve(process.cwd(), '../../exports', `knowledge-db-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`)
  const outputFile = process.argv[2] || defaultOutput

  console.info(`[export-db] Exporting database to: ${outputFile}`)

  // Ensure output directory exists
  const outputDir = resolve(outputFile, '..')
  await mkdir(outputDir, { recursive: true })

  // Fetch all posts (excluding vector data and private fields)
  const posts = await db
    .select({
      id: postsTable.id,
      source: postsTable.source,
      content: postsTable.content,
      posted_at: postsTable.posted_at,
    })
    .from(postsTable)
    .orderBy(postsTable.posted_at)

  // Transform data for public export
  const publicPosts = posts.map(post => ({
    id: post.id,
    source: post.source,
    content: post.content,
    // Convert to date-only format for additional privacy
    posted_date: new Date(post.posted_at).toISOString().split('T')[0],
  }))

  // Create export data with privacy notice
  const exportData = {
    exported_at: new Date().toISOString(),
    total_posts: publicPosts.length,
    notice: 'Privacy protection: author, url, and external_id fields are excluded from this export',
    license: 'MIT',
    usage_note: 'This data is from the developer\'s own posts. Feel free to use for prompt engineering research. Please use responsibly.',
    data_sources: [...new Set(posts.map(p => p.source))],
    posts: publicPosts,
  }

  // Write to file
  writeFileSync(outputFile, JSON.stringify(exportData, null, 2), 'utf-8')

  console.info(`[export-db] Successfully exported ${publicPosts.length} posts`)
  console.info(`[export-db] Privacy-protected fields: content, source, posted_date only`)
  console.info(`[export-db] Excluded for privacy: author, url, external_id`)
  console.info(`[export-db] Output file: ${outputFile}`)
}

main().catch(console.error).finally(() => process.exit(0))
