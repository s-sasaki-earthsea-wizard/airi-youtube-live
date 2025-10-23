/**
 * Knowledge DB Composables
 *
 * Centralized exports for all knowledge-related composables
 */

export {
  deduplicateResults,
  mergeKnowledgeResults,
  sortBySimilarity,
} from './knowledgeResultMerger'
export { useExpandedSearch } from './useExpandedSearch'
export type {
  ExpandedSearchOptions,
  ExpandedSearchResult,
} from './useExpandedSearch'
export { useKnowledgeDB } from './useKnowledgeDB'

export type {
  KnowledgeDBConfig,
  KnowledgeResponse,
  KnowledgeResult,
} from './useKnowledgeDB'

export { useKnowledgeDBIntegration } from './useKnowledgeDBIntegration'

export { useQueryExpansion } from './useQueryExpansion'

export type {
  ExpandedQuery,
  QueryExpansionConfig,
} from './useQueryExpansion'

export { useReranking } from './useReranking'
