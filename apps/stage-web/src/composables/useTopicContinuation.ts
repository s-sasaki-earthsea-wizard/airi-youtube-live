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

import { ref } from 'vue'

import { useKnowledgeDB } from './useKnowledgeDB'

export interface TopicContinuationConfig {
  maxContinuation: number
  enabled: boolean
}

/**
 * Topic Continuation Composable
 */
export function useTopicContinuation(config: TopicContinuationConfig) {
  const knowledgeDB = useKnowledgeDB()

  const lastResponse = ref<string | null>(null)
  const initialTopic = ref<string | null>(null)
  const contextContinuationCount = ref(0)

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
   */
  async function buildContinuationPrompt(): Promise<string> {
    if (!lastResponse.value) {
      throw new Error('[TopicContinuation] Cannot build continuation prompt: no previous response')
    }

    console.info('[TopicContinuation] Building continuation prompt')
    console.info(`[TopicContinuation] Continuation count: ${contextContinuationCount.value + 1}/${config.maxContinuation}`)
    console.info(`[TopicContinuation] Previous response: ${lastResponse.value.substring(0, 50)}...`)

    // Search for related knowledge to enrich the continuation
    let relatedKnowledge = ''
    try {
      const relatedResults = await knowledgeDB.queryKnowledge(lastResponse.value, {
        limit: 3,
        threshold: 0.6,
      })

      if (relatedResults && relatedResults.results.length > 0) {
        console.info(`[TopicContinuation] Found ${relatedResults.results.length} related knowledge items`)
        relatedKnowledge = `\n【あなたの関連する過去の発言】\n${
          relatedResults.results
            .map(k => `- ${k.content.substring(0, 100)}${k.content.length > 100 ? '...' : ''}`)
            .join('\n')
        }\n`
      }
    }
    catch (error) {
      console.warn('[TopicContinuation] Failed to fetch related knowledge, continuing without it', error)
    }

    // Increment continuation counter
    contextContinuationCount.value++

    return `前回あなたはこう話しました：
「${lastResponse.value}」
${relatedKnowledge}
この話題について、さらに深掘りして200文字程度で話してください。
自然な会話の流れで、関連する思い出や考えを加えてください。
「さっきの話の続きだけど」のような前置きは不要です。直接内容に入ってください。`
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
    console.info('[TopicContinuation] Context reset')
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
  }
}
