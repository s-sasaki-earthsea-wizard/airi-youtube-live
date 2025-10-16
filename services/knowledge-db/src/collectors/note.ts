/**
 * note.com Data Collector
 *
 * Collects articles from note.com and stores them in the knowledge database.
 * This is a placeholder implementation - actual note.com integration will be added later.
 */

import { db } from '../db/client.js'
import { postsTable } from '../db/schema.js'

import 'dotenv/config'

async function collectNoteData() {
  console.info('[note Collector] Starting data collection...')

  // TODO: Implement note.com scraping or API integration
  // - Fetch articles from specified accounts
  // - Parse article content
  // - Generate embeddings for vector search
  // - Store in database

  console.info('[note Collector] note.com integration not yet implemented')

  // Example: Insert dummy data for testing
  try {
    const result = await db.insert(postsTable).values({
      source: 'note',
      external_id: 'example-note-id',
      author: 'example_author',
      content: 'This is an example note article for testing',
      url: 'https://note.com/example_author/n/abc123',
      posted_at: Date.now(),
    }).onConflictDoNothing()

    console.info('[note Collector] Example data inserted:', result)
  }
  catch (error) {
    console.error('[note Collector] Error inserting example data:', error)
  }

  console.info('[note Collector] Collection complete')
}

// Run collector
collectNoteData().catch(console.error)
