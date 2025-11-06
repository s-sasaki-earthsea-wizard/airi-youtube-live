/**
 * Topic Continuation Composable
 *
 * Manages multi-turn conversation continuation logic.
 * Can be used for both idle talk and user chat inputs.
 *
 * Features:
 * - Context state management (lastResponse, continuationCount)
 * - Continuation prompt building with Knowledge DB integration
 * - Automatic context reset when max continuation is reached
 *
 * Usage:
 * - Call storeResponse() after each assistant response
 * - Call shouldContinue() to check if continuation is possible
 * - Call buildContinuationPrompt() to get the next prompt
 * - Call resetContext() to start a new topic
 */

import process from 'node:process'

import { ref } from 'vue'

import { useExpandedSearch } from './knowledge/useExpandedSearch'

export interface TopicContinuationConfig {
  maxContinuation: number
  enabled: boolean
}

export interface TopicContinuationSearchConfig {
  limit: number
  threshold: number
  maxKeywords: number
}

/**
 * Get topic continuation search configuration from environment variables
 *
 * Note: Supports both Vite (import.meta.env) and Node.js (process.env) environments
 */
function getTopicContinuationSearchConfig(): TopicContinuationSearchConfig {
  // Support both Vite and Node.js environments
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  return {
    limit: Number.parseInt(env.VITE_TOPIC_CONTINUATION_LIMIT || '3', 10),
    threshold: Number.parseFloat(env.VITE_TOPIC_CONTINUATION_THRESHOLD || '0.6'),
    maxKeywords: Number.parseInt(env.VITE_TOPIC_CONTINUATION_MAX_KEYWORDS || '5', 10),
  }
}

/**
 * Topic Continuation Composable
 */
export function useTopicContinuation(config: TopicContinuationConfig) {
  const expandedSearch = useExpandedSearch()
  const searchConfig = getTopicContinuationSearchConfig()

  const lastResponse = ref<string | null>(null)
  const initialTopic = ref<string | null>(null)
  const contextContinuationCount = ref(0)
  const instructionText = ref<string | null>(null)
  const usedKnowledgeIds = ref<Set<string>>(new Set())

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
      const response = await fetch('/prompts/topic-continuation-instruction.md')
      if (!response.ok) {
        throw new Error(`Failed to load topic continuation instruction: ${response.status}`)
      }
      const text = await response.text()
      instructionText.value = text
      return text
    }
    catch (err) {
      console.warn('[TopicContinuation] Failed to load instruction file, using default', err)
      // Fallback to simple default instruction
      const defaultInstruction = '以下はこの話題に関連するあなたの過去の発言です。これらを参考にして会話してください。'
      instructionText.value = defaultInstruction
      return defaultInstruction
    }
  }

  /**
   * Check if we should continue the current topic
   */
  function shouldContinue(): boolean {
    return config.enabled
      && lastResponse.value !== null
      && contextContinuationCount.value < config.maxContinuation
  }

  /**
   * Build continuation prompt based on last response
   * Includes related knowledge from Knowledge DB
   * Searches using both initial topic and last response to enable deeper associations
   * If no related knowledge is found, instructs to speak from a general perspective
   */
  async function buildContinuationPrompt(): Promise<string> {
    if (!lastResponse.value) {
      throw new Error('[TopicContinuation] Cannot build continuation prompt: no previous response')
    }

    console.info('[TopicContinuation] Building continuation prompt')
    console.info(`[TopicContinuation] Continuation count: ${contextContinuationCount.value + 1}/${config.maxContinuation}`)
    console.info(`[TopicContinuation] Previous response: ${lastResponse.value.substring(0, 50)}...`)
    if (initialTopic.value) {
      console.info(`[TopicContinuation] Initial topic: ${initialTopic.value.substring(0, 50)}...`)
    }

    // Search for related knowledge to enrich the continuation
    // Use both initial topic and last response to enable deeper topic associations
    // Uses expanded search with query expansion for better topic discovery
    let relatedKnowledge = ''
    let hasKnowledge = false
    try {
      // Build combined query: include both initial topic and recent context
      const queryText = initialTopic.value
        ? `${initialTopic.value} ${lastResponse.value}`
        : lastResponse.value

      console.info(`[TopicContinuation] Querying Knowledge DB with combined context (${queryText.length} chars)`)
      console.info('[TopicContinuation] Using expanded search with query expansion')

      // Use expanded search instead of simple query for better topic association
      // Exclude already used knowledge IDs to prevent repetition
      const excludeIds = Array.from(usedKnowledgeIds.value)
      console.info(
        `[TopicContinuation] Excluding ${excludeIds.length} already used knowledge IDs`,
      )

      const searchResult = await expandedSearch.searchWithExpansion(queryText, {
        limit: searchConfig.limit,
        threshold: searchConfig.threshold,
        maxKeywords: searchConfig.maxKeywords,
        excludeIds,
      })

      if (searchResult.expandedKeywords && searchResult.expandedKeywords.length > 0) {
        console.info(`[TopicContinuation] Query expanded to keywords:`, searchResult.expandedKeywords)
      }

      if (searchResult.response && searchResult.response.results.length > 0) {
        hasKnowledge = true
        console.info(
          `[TopicContinuation] Found ${searchResult.response.results.length} related knowledge items `
          + `(strategy: ${searchResult.searchStrategy})`,
        )

        // Track used knowledge IDs
        searchResult.response.results.forEach((result) => {
          usedKnowledgeIds.value.add(result.id)
        })

        const instruction = await loadInstructionText()
        relatedKnowledge = `\n${instruction}\n\n${searchResult.response.results
          .map(k => `- ${k.content.substring(0, 100)}${k.content.length > 100 ? '...' : ''}`)
          .join('\n')
        }\n`
      }
      else {
        console.info('[TopicContinuation] No related knowledge found, will use general perspective')
      }
    }
    catch (error) {
      console.warn('[TopicContinuation] Failed to fetch related knowledge, continuing without it', error)
    }

    // Increment continuation counter
    contextContinuationCount.value++

    // Build prompt based on whether we have knowledge or not
    if (hasKnowledge) {
      return `前回あなたはこう話しました：
「${lastResponse.value}」
${relatedKnowledge}
この話題について、さらに深掘りして200文字程度で話してください。
自然な会話の流れで、関連する思い出や考えを加えてください。
「さっきの話の続きだけど」のような前置きは不要です。直接内容に入ってください。`
    }
    else {
      return `前回あなたはこう話しました：
「${lastResponse.value}」

あなたはこの話題について詳しい知識や経験を持っていません。
「個人的にはあまり詳しくないけど」「よく知らないんだけど、一般論で言うと」のような前置きをして、
一般的な見解や推測程度に留めて200文字程度で話してください。
知ったかぶりをせず、正直に知識の限界を示すことが大切です。
「さっきの話の続きだけど」のような前置きは不要です。直接内容に入ってください。`
    }
  }

  /**
   * Store assistant response for continuation
   */
  function storeResponse(response: string, isInitialTopic = false) {
    lastResponse.value = response
    if (isInitialTopic) {
      initialTopic.value = response
      contextContinuationCount.value = 0
      console.info('[TopicContinuation] Stored initial topic')
    }
    console.info(`[TopicContinuation] Stored response: ${response.substring(0, 50)}...`)
  }

  /**
   * Reset context to start a new topic
   */
  function resetContext() {
    lastResponse.value = null
    initialTopic.value = null
    contextContinuationCount.value = 0
    usedKnowledgeIds.value.clear()
    console.info('[TopicContinuation] Context reset (including used knowledge IDs)')
  }

  /**
   * Get current continuation count
   */
  function getContinuationCount(): number {
    return contextContinuationCount.value
  }

  /**
   * Check if max continuation is reached
   */
  function isMaxReached(): boolean {
    return contextContinuationCount.value >= config.maxContinuation
  }

  /**
   * Get array of used knowledge IDs
   * These IDs should be excluded from system prompt queries
   */
  function getUsedKnowledgeIds(): string[] {
    return Array.from(usedKnowledgeIds.value)
  }

  return {
    // State
    lastResponse,
    initialTopic,
    contextContinuationCount,

    // Methods
    shouldContinue,
    buildContinuationPrompt,
    storeResponse,
    resetContext,
    getContinuationCount,
    isMaxReached,
    getUsedKnowledgeIds,
  }
}
