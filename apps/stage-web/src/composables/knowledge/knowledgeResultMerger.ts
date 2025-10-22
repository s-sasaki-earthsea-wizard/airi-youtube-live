/**
 * Knowledge Result Merger
 *
 * Utility functions for merging, deduplicating, and sorting
 * knowledge search results from multiple queries.
 */

import type { KnowledgeResponse, KnowledgeResult } from './useKnowledgeDB'

/**
 * Merge multiple knowledge responses and deduplicate by ID
 * Keeps the highest similarity score for duplicates
 *
 * @param responses - Array of knowledge responses to merge
 * @returns Merged and deduplicated response, or null if empty
 */
export function mergeKnowledgeResults(
  responses: (KnowledgeResponse | null)[],
): KnowledgeResponse | null {
  // Filter out null responses
  const validResponses = responses.filter(
    (r): r is KnowledgeResponse => r !== null && r.results.length > 0,
  )

  if (validResponses.length === 0) {
    return null
  }

  // Collect all results
  const allResults: KnowledgeResult[] = []
  validResponses.forEach((response) => {
    allResults.push(...response.results)
  })

  // Deduplicate and sort
  const deduplicated = deduplicateResults(allResults)
  const sorted = sortBySimilarity(deduplicated)

  return {
    query: validResponses[0].query,
    results: sorted,
    total: sorted.length,
  }
}

/**
 * Deduplicate results by ID, keeping highest similarity
 *
 * @param results - Array of knowledge results
 * @returns Deduplicated results
 */
export function deduplicateResults(
  results: KnowledgeResult[],
): KnowledgeResult[] {
  const uniqueMap = new Map<string, KnowledgeResult>()

  results.forEach((result) => {
    const existing = uniqueMap.get(result.id)

    // Keep the entry with higher similarity score
    if (!existing || result.similarity > existing.similarity) {
      uniqueMap.set(result.id, result)
    }
  })

  return Array.from(uniqueMap.values())
}

/**
 * Sort results by similarity score in descending order
 *
 * @param results - Array of knowledge results
 * @returns Sorted results
 */
export function sortBySimilarity(
  results: KnowledgeResult[],
): KnowledgeResult[] {
  return [...results].sort((a, b) => b.similarity - a.similarity)
}
