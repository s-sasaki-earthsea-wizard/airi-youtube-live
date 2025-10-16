/**
 * Export knowledge database to JSON file
 *
 * This script exports all posts from the knowledge database to a JSON file.
 * Vector data is excluded to keep file size manageable.
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

  // Fetch all posts (excluding vector data)
  const posts = await db
    .select({
      id: postsTable.id,
      external_id: postsTable.external_id,
      source: postsTable.source,
      author: postsTable.author,
      content: postsTable.content,
      url: postsTable.url,
      posted_at: postsTable.posted_at,
      created_at: postsTable.created_at,
      updated_at: postsTable.updated_at,
    })
    .from(postsTable)
    .orderBy(postsTable.posted_at)

  // Create export data
  const exportData = {
    exported_at: new Date().toISOString(),
    total_posts: posts.length,
    posts,
  }

  // Write to file
  writeFileSync(outputFile, JSON.stringify(exportData, null, 2), 'utf-8')

  console.info(`[export-db] Successfully exported ${posts.length} posts`)
  console.info(`[export-db] Output file: ${outputFile}`)
}

main().catch(console.error).finally(() => process.exit(0))
