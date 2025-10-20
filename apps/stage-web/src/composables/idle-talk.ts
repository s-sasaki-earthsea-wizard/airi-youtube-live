/**
 * Idle Talk Composable
 *
 * Manages conversation topic continuation for both user-initiated and automatic conversations.
 *
 * Features:
 * - Timer-based idle detection for automatic conversation
 * - Random topic selection from Knowledge DB when idle
 * - Topic continuation for both user input and idle talk
 * - Automatic LLM response generation and TTS playback
 * - Configurable via environment variables
 *
 * Design:
 * - User input: Starts a new topic, then continues it for N iterations
 * - Idle timeout: If no context, starts with random topic; otherwise continues current topic
 * - Both paths are treated equally after initial topic selection
 */

import type { ChatProvider } from '@xsai-ext/shared-providers'

import { useSpeakingStore } from '@proj-airi/stage-ui/stores/audio'
import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { ref } from 'vue'

import { useKnowledgeDB } from './useKnowledgeDB'
import { useTopicContinuation } from './useTopicContinuation'

export interface IdleTalkConfig {
  enabled: boolean
  timeout: number // milliseconds
  mode: 'random' | 'sequential'
  minSimilarity: number // 0-1
  continueContext: boolean // whether to continue previous topic
  maxContextContinuation: number // maximum number of times to continue the same topic
  topicHistorySize: number // number of recent topics to remember and exclude
  fetchLimit: number // number of random topics to fetch from Knowledge DB
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

  // Initialize topic continuation composable
  const topicContinuation = useTopicContinuation({
    maxContinuation: config.maxContextContinuation,
    enabled: config.continueContext,
  })

  const isEnabled = ref(config.enabled)
  const lastInteractionTime = ref(Date.now())
  const idleTimerId = ref<number | null>(null)
  const recentTopicIds = ref<string[]>([]) // Track recently used topic IDs to avoid repetition
  const initialTopicInstruction = ref<string | null>(null) // Cache for initial topic instruction

  /**
   * Load initial topic instruction from file
   * Loads once and caches the result
   */
  async function loadInitialTopicInstruction(): Promise<string> {
    // Return cached version if already loaded
    if (initialTopicInstruction.value !== null) {
      return initialTopicInstruction.value
    }

    try {
      const response = await fetch('/prompts/idle-talk-initial-topic.md')
      if (!response.ok) {
        throw new Error(`Failed to load idle talk instruction: ${response.status}`)
      }
      const text = await response.text()
      initialTopicInstruction.value = text
      return text
    }
    catch (err) {
      console.warn('[IdleTalk] Failed to load instruction file, using default', err)
      // Fallback to simple default instruction
      const defaultInstruction = '以下の話題について話してください。'
      initialTopicInstruction.value = defaultInstruction
      return defaultInstruction
    }
  }

  /**
   * Reset idle timer
   * @param clearContext - If true, clears the topic context (starting new topic)
   */
  function resetIdleTimer(clearContext = true) {
    lastInteractionTime.value = Date.now()

    // Clear context when starting a new topic
    if (clearContext) {
      topicContinuation.resetContext()
      console.info('[IdleTalk] Context cleared, starting new topic')
    }

    if (idleTimerId.value) {
      console.info(`[IdleTalk] Clearing existing timer #${idleTimerId.value}`)
      clearTimeout(idleTimerId.value)
      idleTimerId.value = null
    }

    if (isEnabled.value) {
      console.info('[IdleTalk] Starting new timer')
      startIdleTimer()
    }
    else {
      console.info(`[IdleTalk] Not starting timer: isEnabled=${isEnabled.value}`)
    }
  }

  /**
   * Start idle timer
   */
  function startIdleTimer() {
    const timerId = setTimeout(async () => {
      await handleIdleTimeout()
    }, config.timeout) as unknown as number

    idleTimerId.value = timerId
    console.info(`[IdleTalk] Started timer #${timerId}, will trigger in ${config.timeout}ms`)
  }

  /**
   * Handle idle timeout
   * Continues current topic if context exists, otherwise starts new random topic
   */
  async function handleIdleTimeout() {
    console.info(`[IdleTalk] Timer fired. isEnabled=${isEnabled.value}, isCurrentlyIdleTalking=${isCurrentlyIdleTalking.value}`)

    if (!isEnabled.value || isCurrentlyIdleTalking.value) {
      console.warn(`[IdleTalk] Skipping idle timeout: isEnabled=${isEnabled.value}, isCurrentlyIdleTalking=${isCurrentlyIdleTalking.value}`)
      return
    }

    // Check if character is currently speaking
    const speakingStore = useSpeakingStore()
    if (speakingStore.nowSpeaking) {
      console.info('[IdleTalk] Character is currently speaking, deferring idle talk')
      // Restart timer to check again later
      resetIdleTimer(false)
      return
    }

    console.info('[IdleTalk] Idle timeout detected, starting automatic conversation')

    try {
      isCurrentlyIdleTalking.value = true
      console.info('[IdleTalk] Set isCurrentlyIdleTalking = true')

      // Build prompt based on context continuation state
      const userPrompt = await buildIdleTalkPrompt()

      if (!userPrompt) {
        console.warn('[IdleTalk] Failed to build idle talk prompt')
        return
      }

      // Get LLM provider and model
      const llmProvider = consciousnessStore.activeProvider
      const llmModel = consciousnessStore.activeModel

      console.info('[IdleTalk] Checking LLM provider:', {
        llmProvider,
        llmModel,
        hasProvider: !!llmProvider,
        hasModel: !!llmModel,
      })

      if (!llmProvider || !llmModel) {
        console.warn('[IdleTalk] No LLM provider configured')
        console.warn('[IdleTalk] consciousnessStore state:', {
          activeProvider: consciousnessStore.activeProvider,
          activeModel: consciousnessStore.activeModel,
        })
        return
      }

      const providerInstance = await providersStore.getProviderInstance(llmProvider)
      const providerConfig = providersStore.getProviderConfig(llmProvider)

      if (!providerInstance || !('chat' in providerInstance)) {
        console.error('[IdleTalk] Failed to get ChatProvider instance')
        return
      }

      console.info('[IdleTalk] Sending idle talk prompt to LLM')
      console.info('[IdleTalk] Prompt content:', userPrompt)

      try {
        // Record the current chat history length before sending
        const initialHistoryLength = chatStore.messages.length
        console.info(`[IdleTalk] Initial chat history length: ${initialHistoryLength}`)

        // Set up a one-time hook to mark the prompt message as hidden in UI
        let hookExecuted = false
        const hidePromptHook = async () => {
          if (hookExecuted)
            return

          // Find the user message we just added and mark it as hidden in UI
          const userMessageIndex = chatStore.messages.findLastIndex(msg => msg.role === 'user')
          if (userMessageIndex !== -1 && userMessageIndex >= initialHistoryLength) {
            // Add _hideInUI flag to hide this internal prompt from UI
            (chatStore.messages[userMessageIndex] as any)._hideInUI = true
            console.info(`[IdleTalk] Marked idle talk prompt as hidden in UI at index ${userMessageIndex}`)
          }

          hookExecuted = true
        }

        // Register the hook before sending
        chatStore.onAfterMessageComposed(hidePromptHook)

        // Send the topic as a user message
        // This will trigger all the necessary pipelines (TTS, etc.)
        // Knowledge DB integration will check isCurrentlyIdleTalking and skip the query
        await chatStore.send(userPrompt, {
          model: llmModel,
          chatProvider: providerInstance as ChatProvider,
          providerConfig,
        })

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
      console.info('[IdleTalk] Setting isCurrentlyIdleTalking = false')
      isCurrentlyIdleTalking.value = false
      // Note: Timer will be restarted by onAssistantResponseEnd hook
      // No need to call resetIdleTimer() here
    }
  }

  /**
   * Get random topic from knowledge database
   * Used when there's no current topic context
   * Automatically excludes recently used topics to prevent repetition
   */
  async function getRandomTopic() {
    if (!knowledgeDB.config.enabled) {
      console.warn('[IdleTalk] Knowledge DB is not enabled')
      return null
    }

    try {
      // Get topics from Knowledge DB with exclusions
      const topics = await knowledgeDB.getRandomTopic({
        limit: config.fetchLimit,
        excludeIds: recentTopicIds.value,
      })

      if (!topics || topics.length === 0) {
        // If no topics available (all excluded), clear history and try again
        if (recentTopicIds.value.length > 0) {
          console.warn('[IdleTalk] No topics available after exclusions, clearing history')
          recentTopicIds.value = []
          const retryTopics = await knowledgeDB.getRandomTopic({ limit: config.fetchLimit })
          if (!retryTopics || retryTopics.length === 0) {
            return null
          }
          const selectedTopic = retryTopics[Math.floor(Math.random() * retryTopics.length)]
          addTopicToHistory(selectedTopic.id)
          console.info(`[IdleTalk] Selected random topic from ${selectedTopic.author}: ${selectedTopic.content.substring(0, 50)}...`)
          return selectedTopic
        }
        return null
      }

      // Pick random topic from results
      const randomIndex = Math.floor(Math.random() * topics.length)
      const selectedTopic = topics[randomIndex]

      // Add to history to avoid repeating
      addTopicToHistory(selectedTopic.id)

      console.info(`[IdleTalk] Selected random topic from ${selectedTopic.author}: ${selectedTopic.content.substring(0, 50)}...`)
      console.info(`[IdleTalk] Topic history (${recentTopicIds.value.length}/${config.topicHistorySize}): ${recentTopicIds.value.join(', ')}`)

      return selectedTopic
    }
    catch (error) {
      console.error('[IdleTalk] Error fetching random topic:', error)
      return null
    }
  }

  /**
   * Add topic ID to history and maintain size limit
   */
  function addTopicToHistory(topicId: string) {
    recentTopicIds.value.push(topicId)
    if (recentTopicIds.value.length > config.topicHistorySize) {
      recentTopicIds.value.shift() // Remove oldest
    }
  }

  /**
   * Build prompt for conversation continuation or new topic
   * - If there's a previous response context: Build continuation prompt
   * - Otherwise: Start with a new random topic from Knowledge DB
   * This function is only called when idle timeout triggers
   */
  async function buildIdleTalkPrompt(): Promise<string | null> {
    // Check if we should continue from previous response
    if (topicContinuation.shouldContinue()) {
      return await topicContinuation.buildContinuationPrompt()
    }

    // Reset context when max continuation is reached
    if (topicContinuation.isMaxReached()) {
      console.info('[IdleTalk] Max context continuation reached, resetting to new topic')
      topicContinuation.resetContext()
    }

    // Start with a new random topic
    const topic = await getRandomTopic()

    if (!topic) {
      return null
    }

    // Store initial topic
    topicContinuation.storeResponse(topic.content, true)

    // Load instruction from file
    const instruction = await loadInitialTopicInstruction()

    return `コメントが無いので、以下の話題をテーマに話してください：

話題: ${topic.content}

${instruction}`
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
    console.info(`[IdleTalk] Context continuation: ${config.continueContext ? 'enabled' : 'disabled'}`)
    if (config.continueContext) {
      console.info(`[IdleTalk] Max context continuation: ${config.maxContextContinuation} times`)
    }

    // Start initial timer
    startIdleTimer()

    // Register hook to clear context when user starts a new topic
    // This marks the beginning of a new conversation topic
    chatStore.onBeforeMessageComposed(async () => {
      // Skip if idle talk is in progress (to preserve continuation count)
      if (isCurrentlyIdleTalking.value) {
        console.info('[IdleTalk] Skipping context clear (idle talk in progress)')
        return
      }

      // Clear previous topic context when user sends a new message
      topicContinuation.resetContext()
      console.info('[IdleTalk] User input detected, cleared previous topic context')
    }, { persistent: true })

    // Register hook to reset timer after assistant response completes
    // This ensures we wait for the full response (including TTS) before starting idle timer
    // Both user topics and idle talk topics are treated the same way
    chatStore.onAssistantResponseEnd(async (fullText: string) => {
      console.info('[IdleTalk] Assistant response ended, storing response for continuation')

      // Store the assistant's response for topic continuation
      topicContinuation.storeResponse(fullText)

      // Reset timer with context preservation
      // Whether it was user input or idle talk doesn't matter - we continue the topic
      resetIdleTimer(false)
    }, { persistent: true })

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
