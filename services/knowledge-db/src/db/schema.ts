import { bigint, index, pgTable, text, uniqueIndex, uuid, vector } from 'drizzle-orm/pg-core'

/**
 * Posts table - stores content from external services (Twitter, note, etc.)
 */
export const postsTable = pgTable('posts', {
  id: uuid().primaryKey().defaultRandom(),
  source: text().notNull().default(''), // 'twitter', 'note', 'blog', etc.
  external_id: text().notNull().default(''), // External service post ID
  author: text().notNull().default(''), // Post author name
  content: text().notNull().default(''), // Post content/text
  url: text().default(''), // URL to original post
  posted_at: bigint({ mode: 'number' }).notNull().default(0), // Original post timestamp
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  // Vector embeddings for semantic search
  content_vector_1536: vector({ dimensions: 1536 }), // OpenAI text-embedding-3-small
  content_vector_1024: vector({ dimensions: 1024 }), // Alternative embedding size
  content_vector_768: vector({ dimensions: 768 }), // Alternative embedding size
}, table => [
  // Ensure no duplicate posts from same source
  uniqueIndex('posts_source_external_id_unique_index').on(table.source, table.external_id),
  // Vector similarity search indexes
  index('posts_content_vector_1536_index').using('hnsw', table.content_vector_1536.op('vector_cosine_ops')),
  index('posts_content_vector_1024_index').using('hnsw', table.content_vector_1024.op('vector_cosine_ops')),
  index('posts_content_vector_768_index').using('hnsw', table.content_vector_768.op('vector_cosine_ops')),
  // Standard indexes for filtering
  index('posts_source_index').on(table.source),
  index('posts_author_index').on(table.author),
  index('posts_posted_at_index').on(table.posted_at),
])

/**
 * Tags table - for categorizing posts
 */
export const tagsTable = pgTable('tags', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(), // Tag name (e.g., 'programming', 'music', 'daily-life')
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  index('tags_name_index').on(table.name),
])

/**
 * Post-tag relationship table (many-to-many)
 */
export const postTagsTable = pgTable('post_tags', {
  id: uuid().primaryKey().defaultRandom(),
  post_id: uuid().notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  tag_id: uuid().notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('post_tags_post_tag_unique_index').on(table.post_id, table.tag_id),
  index('post_tags_post_id_index').on(table.post_id),
  index('post_tags_tag_id_index').on(table.tag_id),
])

/**
 * Metadata table - for storing system metadata like last sync times, API tokens, etc.
 */
export const metadataTable = pgTable('metadata', {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(), // Metadata key (e.g., 'twitter_last_sync', 'note_api_token')
  value: text().notNull().default(''), // Metadata value (JSON or plain text)
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  index('metadata_key_index').on(table.key),
])
