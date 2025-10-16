import { env } from 'node:process'

import pg from 'pg'

import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from './schema.js'

const { Pool } = pg

// Get database URL from environment variable
const DATABASE_URL = env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
})

// Create Drizzle ORM instance
export const db = drizzle({ client: pool, schema })

// Export types
export type Database = typeof db
