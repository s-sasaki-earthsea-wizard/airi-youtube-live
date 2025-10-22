/**
 * Knowledge Database Composable
 *
 * Provides integration with the knowledge-db service for RAG (Retrieval-Augmented Generation).
 * Queries the vector similarity search endpoint to find relevant character knowledge.
 */

import process from 'node:process'

import { ref } from 'vue'

export interface KnowledgeResult {
  id: string
  source: string
  author: string
  content: string
  url?: string
  posted_at: number
  similarity: number
}

export interface KnowledgeResponse {
  query: string
  results: KnowledgeResult[]
  total: number
}

export interface KnowledgeDBConfig {
  enabled: boolean
  url: string
  limit: number
  threshold: number
}

/**
 * Get knowledge DB configuration from environment variables
 *
 * Note: Supports both Vite (import.meta.env) and Node.js (process.env) environments
 */
function getKnowledgeDBConfig(): KnowledgeDBConfig {
  // Support both Vite and Node.js environments
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  return {
    enabled: env.VITE_KNOWLEDGE_DB_ENABLED === 'true',
    url: env.VITE_KNOWLEDGE_DB_URL || 'http://localhost:3100',
    limit: Number.parseInt(env.VITE_KNOWLEDGE_DB_LIMIT || '3', 10),
    threshold: Number.parseFloat(env.VITE_KNOWLEDGE_DB_THRESHOLD || '0.3'),
  }
}

export function useKnowledgeDB() {
  const config = getKnowledgeDBConfig()
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const instructionText = ref<string | null>(null)

  /**
   * Load instruction text from file
   * Loads once and caches the result
   */
  async function loadInstructionText(): Promise<string> {
    // Return cached version if already loaded
    if (instructionText.value !== null) {
      return instructionText.value
    }

    try {
      const response = await fetch('/prompts/knowledge-db-instruction.md')
      if (!response.ok) {
        throw new Error(`Failed to load knowledge DB instruction: ${response.status}`)
      }
      const text = await response.text()
      instructionText.value = text
      return text
    }
    catch (err) {
      console.warn('[useKnowledgeDB] Failed to load instruction file, using default', err)
      // Fallback to simple default instruction
      const defaultInstruction = '以下はあなたの過去の発言から関連する内容です。これらを参考にして会話してください。'
      instructionText.value = defaultInstruction
      return defaultInstruction
    }
  }

  /**
   * Query the knowledge database for relevant information
   *
   * @param query - Search query text
   * @param options - Optional query parameters
   * @param options.limit - Maximum number of results to return
   * @param options.threshold - Minimum similarity score (0-1)
   * @returns Promise with knowledge results
   */
  async function queryKnowledge(
    query: string,
    options?: { limit?: number, threshold?: number },
  ): Promise<KnowledgeResponse | null> {
    // Skip if knowledge DB is disabled
    if (!config.enabled) {
      console.info('[useKnowledgeDB] Knowledge DB is disabled')
      return null
    }

    // Skip empty queries
    if (!query || query.trim() === '') {
      console.warn('[useKnowledgeDB] Empty query provided')
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const limit = options?.limit ?? config.limit
      const threshold = options?.threshold ?? config.threshold

      const url = new URL('/knowledge', config.url)
      url.searchParams.set('query', query)
      url.searchParams.set('limit', limit.toString())
      url.searchParams.set('threshold', threshold.toString())

      console.info(`[useKnowledgeDB] Querying: ${query}`)

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Knowledge DB query failed: ${response.status} ${response.statusText}`)
      }

      const data: KnowledgeResponse = await response.json()

      console.info(`[useKnowledgeDB] Found ${data.total} results (similarity >= ${threshold})`)

      return data
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useKnowledgeDB] Query failed:', errorMessage)
      error.value = err instanceof Error ? err : new Error(errorMessage)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Get random topics from knowledge database (for idle talk feature)
   *
   * @param options - Optional parameters (limit, source, excludeIds)
   * @param options.limit - Maximum number of random posts to return
   * @param options.source - Filter by source (e.g., 'discord', 'twitter')
   * @param options.excludeIds - Array of post IDs to exclude from results
   * @returns Promise with random posts (without similarity scores)
   */
  async function getRandomTopic(
    options?: { limit?: number, source?: string, excludeIds?: string[] },
  ): Promise<Omit<KnowledgeResult, 'similarity'>[] | null> {
    // Skip if knowledge DB is disabled
    if (!config.enabled) {
      console.info('[useKnowledgeDB] Knowledge DB is disabled')
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const limit = options?.limit ?? 5

      const url = new URL('/knowledge/random', config.url)
      url.searchParams.set('limit', limit.toString())

      if (options?.source) {
        url.searchParams.set('source', options.source)
      }

      if (options?.excludeIds && options.excludeIds.length > 0) {
        url.searchParams.set('excludeIds', options.excludeIds.join(','))
      }

      console.info(`[useKnowledgeDB] Fetching ${limit} random topics${options?.excludeIds ? ` (excluding ${options.excludeIds.length} IDs)` : ''}`)

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Knowledge DB random query failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      console.info(`[useKnowledgeDB] Retrieved ${data.total} random topics`)

      return data.posts
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useKnowledgeDB] Random query failed:', errorMessage)
      error.value = err instanceof Error ? err : new Error(errorMessage)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Format knowledge results for injection into system prompt
   *
   * @param results - Knowledge search results
   * @returns Formatted text for system prompt
   */
  async function formatKnowledgeForPrompt(results: KnowledgeResult[]): Promise<string> {
    if (results.length === 0) {
      return ''
    }

    const formattedResults = results
      .map((result, index) => {
        const similarity = (result.similarity * 100).toFixed(1)
        return `${index + 1}. [${similarity}% relevant] ${result.content}`
      })
      .join('\n')

    const instruction = await loadInstructionText()

    return `\n\n${instruction}\n\n${formattedResults}\n`
  }

  return {
    config,
    isLoading,
    error,
    queryKnowledge,
    getRandomTopic,
    formatKnowledgeForPrompt,
  }
}
