/**
 * Idle Talk Composable
 *
 * Monitors user inactivity and triggers automatic conversation
 * based on random topics from the knowledge database.
 *
 * Features:
 * - Timer-based idle detection
 * - Random topic selection from Knowledge DB
 * - Automatic LLM response generation and TTS playback
 * - Configurable via environment variables
 */

import type { ChatProvider } from '@xsai-ext/shared-providers'

import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { ref } from 'vue'

import { useKnowledgeDB } from './useKnowledgeDB'

export interface IdleTalkConfig {
  enabled: boolean
  timeout: number // milliseconds
  mode: 'random' | 'sequential'
  minSimilarity: number // 0-1
}

/**
 * Idle Talk Composable
 */
// Export the idle talking state so other composables can check it
export const isCurrentlyIdleTalking = ref(false)

export function useIdleTalk(config: IdleTalkConfig) {
  const chatStore = useChatStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const knowledgeDB = useKnowledgeDB()

  const isEnabled = ref(config.enabled)
  const lastInteractionTime = ref(Date.now())
  const idleTimerId = ref<number | null>(null)

  /**
   * Reset idle timer whenever user interacts
   */
  function resetIdleTimer() {
    lastInteractionTime.value = Date.now()

    if (idleTimerId.value) {
      clearTimeout(idleTimerId.value)
      idleTimerId.value = null
    }

    if (isEnabled.value && !isCurrentlyIdleTalking.value) {
      startIdleTimer()
    }
  }

  /**
   * Start idle timer
   */
  function startIdleTimer() {
    idleTimerId.value = setTimeout(async () => {
      await handleIdleTimeout()
    }, config.timeout) as unknown as number
  }

  /**
   * Handle idle timeout - trigger automatic conversation
   */
  async function handleIdleTimeout() {
    if (!isEnabled.value || isCurrentlyIdleTalking.value) {
      return
    }

    console.info('[IdleTalk] Idle timeout detected, starting automatic conversation')

    try {
      isCurrentlyIdleTalking.value = true

      // Get random topic from knowledge database
      const randomTopic = await getRandomTopic()

      if (!randomTopic) {
        console.warn('[IdleTalk] No topics available in knowledge database')
        return
      }

      // Build user message for LLM (will be removed from chat history after)
      const userPrompt = buildIdleTalkPrompt(randomTopic)

      // Get LLM provider and model
      const llmProvider = consciousnessStore.activeProvider
      const llmModel = consciousnessStore.activeModel

      if (!llmProvider || !llmModel) {
        console.warn('[IdleTalk] No LLM provider configured')
        return
      }

      const providerInstance = await providersStore.getProviderInstance(llmProvider)
      const providerConfig = providersStore.getProviderConfig(llmProvider)

      if (!providerInstance || !('chat' in providerInstance)) {
        console.error('[IdleTalk] Failed to get ChatProvider instance')
        return
      }

      console.info('[IdleTalk] Sending idle talk prompt to LLM')

      try {
        // Send the topic as a user message
        // This will trigger all the necessary pipelines (TTS, etc.)
        // Knowledge DB integration will check isCurrentlyIdleTalking and skip the query
        await chatStore.send(userPrompt, {
          model: llmModel,
          chatProvider: providerInstance as ChatProvider,
          providerConfig,
        })

        // Remove the prompt message from chat history
        // Keep only the assistant's response to make it look spontaneous
        const promptIndex = chatStore.messages.findIndex(msg =>
          msg.role === 'user' && typeof msg.content === 'string' && msg.content === userPrompt,
        )
        if (promptIndex !== -1) {
          chatStore.messages.splice(promptIndex, 1)
          console.info('[IdleTalk] Removed prompt from chat history')
        }

        console.info('[IdleTalk] LLM response generated successfully')
      }
      catch (error) {
        console.error('[IdleTalk] Failed to generate response:', error)
      }

      console.info('[IdleTalk] Automatic conversation completed')
    }
    catch (error) {
      console.error('[IdleTalk] Error during idle talk:', error)
    }
    finally {
      isCurrentlyIdleTalking.value = false
      // Restart idle timer for next iteration
      resetIdleTimer()
    }
  }

  /**
   * Get random topic from knowledge database
   */
  async function getRandomTopic() {
    if (!knowledgeDB.config.enabled) {
      console.warn('[IdleTalk] Knowledge DB is not enabled')
      return null
    }

    try {
      // Get 5 random topics and pick one randomly (for diversity)
      const topics = await knowledgeDB.getRandomTopic({ limit: 5 })

      if (!topics || topics.length === 0) {
        return null
      }

      // Pick random topic from results
      const randomIndex = Math.floor(Math.random() * topics.length)
      const selectedTopic = topics[randomIndex]

      console.info(`[IdleTalk] Selected topic from ${selectedTopic.author}: ${selectedTopic.content.substring(0, 50)}...`)

      return selectedTopic
    }
    catch (error) {
      console.error('[IdleTalk] Error fetching random topic:', error)
      return null
    }
  }

  /**
   * Build prompt for idle talk
   */
  function buildIdleTalkPrompt(topic: any): string {
    return `コメントが無いので、以下の話題をテーマに自由にリスナーに対して話してください：

話題: ${topic.content}

この話題について、あなたの考えや思い出を200文字程度で話してください。
話し始める前に雑談を始める前にふさわしい前置きをつけてください。
ただし、リスナーへの挨拶等は不要です`
  }

  /**
   * Initialize idle talk monitoring
   */
  function initialize() {
    if (!isEnabled.value) {
      console.info('[IdleTalk] Idle talk feature is disabled')
      return
    }

    console.info('[IdleTalk] Initializing idle talk feature')
    console.info(`[IdleTalk] Timeout: ${config.timeout}ms (${config.timeout / 1000}s)`)
    console.info(`[IdleTalk] Mode: ${config.mode}`)

    // Start initial timer
    startIdleTimer()

    // Register hooks to reset timer on user interaction
    chatStore.onBeforeMessageComposed(async () => {
      resetIdleTimer()
    })

    chatStore.onAfterSend(async () => {
      resetIdleTimer()
    })

    console.info('[IdleTalk] Idle talk monitoring started')
  }

  /**
   * Cleanup
   */
  function dispose() {
    if (idleTimerId.value) {
      clearTimeout(idleTimerId.value)
      idleTimerId.value = null
    }
    console.info('[IdleTalk] Idle talk monitoring stopped')
  }

  return {
    isEnabled,
    lastInteractionTime,
    isIdleTalking: isCurrentlyIdleTalking,

    initialize,
    resetIdleTimer,
    dispose,
  }
}
