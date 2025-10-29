/**
 * Expanded Search Composable
 *
 * Combines query expansion with Knowledge DB vector search.
 * Performs parallel searches using expanded keywords, merges results,
 * and uses LLM-based topic selection to filter for truly relevant content.
 */

import type { KnowledgeResponse } from './useKnowledgeDB'

import process from 'node:process'

import { ref } from 'vue'

import { mergeKnowledgeResults } from './knowledgeResultMerger'
import { useKnowledgeDB } from './useKnowledgeDB'
import { useQueryExpansion } from './useQueryExpansion'
import { useTopicSelection } from './useTopicSelection'

export interface ExpandedSearchOptions {
  limit?: number
  threshold?: number
  maxKeywords?: number
}

export interface ExpandedSearchResult {
  response: KnowledgeResponse | null
  expandedKeywords: string[] | null
  searchStrategy: 'original' | 'expanded' | 'merged'
}

export interface ExpandedSearchConfig {
  maxKeywords: number
  limit: number
  threshold: number
  enabled: boolean
  url: string
}

/**
 * Get expanded search configuration from environment variables
 * Uses separate settings from Knowledge DB prompt queries
 *
 * Note: Supports both Vite (import.meta.env) and Node.js (process.env) environments
 */
function getExpandedSearchConfig(): ExpandedSearchConfig {
  // Support both Vite and Node.js environments
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  return {
    maxKeywords: Number.parseInt(
      env.VITE_EXPANDED_SEARCH_MAX_KEYWORDS || '5',
      10,
    ),
    limit: Number.parseInt(
      env.VITE_EXPANDED_SEARCH_LIMIT || '5',
      10,
    ),
    threshold: Number.parseFloat(
      env.VITE_EXPANDED_SEARCH_THRESHOLD || '0.4',
    ),
    enabled: env.VITE_KNOWLEDGE_DB_ENABLED === 'true',
    url: env.VITE_KNOWLEDGE_DB_URL || 'http://localhost:3100',
  }
}

export function useExpandedSearch() {
  const config = getExpandedSearchConfig()
  const { expandQuery } = useQueryExpansion()
  const { queryKnowledge } = useKnowledgeDB()
  const { selectRelevantTopics } = useTopicSelection()
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * Query knowledge database with LLM-based query expansion
   * Falls back to original query if expansion fails
   *
   * @param query - Original user query
   * @param options - Query options including expansion settings
   * @returns Knowledge response with expansion metadata
   */
  async function searchWithExpansion(
    query: string,
    options?: ExpandedSearchOptions,
  ): Promise<ExpandedSearchResult> {
    // Skip empty queries
    if (!query || query.trim() === '') {
      console.warn('[useExpandedSearch] Empty query provided')
      return {
        response: null,
        expandedKeywords: null,
        searchStrategy: 'original',
      }
    }

    isLoading.value = true
    error.value = null

    try {
      console.info(`[useExpandedSearch] Starting expanded search for: "${query}"`)

      // Step 1: Try query expansion
      const expandedKeywords = await expandQuery(
        query,
        options?.maxKeywords ?? config.maxKeywords,
      )

      // Step 2: If expansion fails, fallback to original query only
      if (!expandedKeywords || expandedKeywords.length === 0) {
        console.info('[useExpandedSearch] Query expansion failed or disabled, using original query')

        const response = await queryKnowledge(query, {
          limit: options?.limit ?? config.limit,
          threshold: options?.threshold ?? config.threshold,
        })

        return {
          response,
          expandedKeywords: null,
          searchStrategy: 'original',
        }
      }

      console.info(
        `[useExpandedSearch] Expanded to ${expandedKeywords.length} keywords:`,
        expandedKeywords,
      )

      // Step 3: Perform parallel searches (original query + expanded keywords)
      const searchPromises = [
        queryKnowledge(query, {
          limit: options?.limit ?? config.limit,
          threshold: options?.threshold ?? config.threshold,
        }),
        ...expandedKeywords.map(keyword =>
          queryKnowledge(keyword, {
            limit: options?.limit ?? config.limit,
            threshold: options?.threshold ?? config.threshold,
          }),
        ),
      ]

      console.info(
        `[useExpandedSearch] Executing ${searchPromises.length} parallel searches...`,
      )

      const searchResults = await Promise.all(searchPromises)

      // Step 4: Merge and deduplicate results
      const mergedResponse = mergeKnowledgeResults(searchResults)

      if (!mergedResponse || mergedResponse.results.length === 0) {
        console.info('[useExpandedSearch] No results found after merging')
        return {
          response: null,
          expandedKeywords,
          searchStrategy: 'expanded',
        }
      }

      console.info(
        `[useExpandedSearch] Merged ${mergedResponse.total} unique results `
        + `(from ${searchResults.filter(r => r !== null).length} searches)`,
      )

      // Step 5: Use LLM to select only truly relevant topics
      console.info('[useExpandedSearch] Applying LLM-based topic selection...')
      const selectionResult = await selectRelevantTopics(
        query,
        mergedResponse.results,
      )

      if (selectionResult.selectedCount === 0) {
        console.info('[useExpandedSearch] No relevant topics selected by LLM')
        return {
          response: null,
          expandedKeywords,
          searchStrategy: 'merged',
        }
      }

      console.info(
        `[useExpandedSearch] Selected ${selectionResult.selectedCount}/${mergedResponse.total} relevant topics`,
      )

      // Return filtered response with only selected topics
      const filteredResponse: KnowledgeResponse = {
        query: mergedResponse.query,
        results: selectionResult.selectedResults,
        total: selectionResult.selectedCount,
      }

      return {
        response: filteredResponse,
        expandedKeywords,
        searchStrategy: 'merged',
      }
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useExpandedSearch] Search failed:', errorMessage)
      error.value = err instanceof Error ? err : new Error(errorMessage)

      return {
        response: null,
        expandedKeywords: null,
        searchStrategy: 'original',
      }
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    searchWithExpansion,
  }
}
