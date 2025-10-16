/**
 * Knowledge Database Composable
 *
 * Provides integration with the knowledge-db service for RAG (Retrieval-Augmented Generation).
 * Queries the vector similarity search endpoint to find relevant character knowledge.
 */

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
 */
function getKnowledgeDBConfig(): KnowledgeDBConfig {
  return {
    enabled: import.meta.env.VITE_KNOWLEDGE_DB_ENABLED === 'true',
    url: import.meta.env.VITE_KNOWLEDGE_DB_URL || 'http://localhost:3100',
    limit: Number.parseInt(import.meta.env.VITE_KNOWLEDGE_DB_LIMIT || '3', 10),
    threshold: Number.parseFloat(import.meta.env.VITE_KNOWLEDGE_DB_THRESHOLD || '0.3'),
  }
}

export function useKnowledgeDB() {
  const config = getKnowledgeDBConfig()
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * Query the knowledge database for relevant information
   *
   * @param query - Search query text
   * @param options - Optional query parameters
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
   * Format knowledge results for injection into system prompt
   *
   * @param results - Knowledge search results
   * @returns Formatted text for system prompt
   */
  function formatKnowledgeForPrompt(results: KnowledgeResult[]): string {
    if (results.length === 0) {
      return ''
    }

    const formattedResults = results
      .map((result, index) => {
        const similarity = (result.similarity * 100).toFixed(1)
        return `${index + 1}. [${similarity}% relevant] ${result.content}`
      })
      .join('\n')

    return `\n\n## 関連する情報（Knowledge Database）\n\n${formattedResults}\n`
  }

  return {
    config,
    isLoading,
    error,
    queryKnowledge,
    formatKnowledgeForPrompt,
  }
}
