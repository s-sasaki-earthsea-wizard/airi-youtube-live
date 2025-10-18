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

import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { nextTick, ref } from 'vue'

import { useKnowledgeDB } from './useKnowledgeDB'

export interface IdleTalkConfig {
  enabled: boolean
  timeout: number // milliseconds
  mode: 'random' | 'sequential'
  minSimilarity: number // 0-1
  continueContext: boolean // whether to continue previous topic
  maxContextContinuation: number // maximum number of times to continue the same topic
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
  const lastResponse = ref<string | null>(null) // Store last AI response for context continuation
  const initialTopic = ref<string | null>(null) // Store initial topic to detect drift
  const contextContinuationCount = ref(0) // Track how many times we've continued the same topic

  /**
   * Reset idle timer
   * @param clearContext - If true, clears the topic context (starting new topic)
   */
  function resetIdleTimer(clearContext = true) {
    lastInteractionTime.value = Date.now()

    // Clear context when starting a new topic
    if (clearContext) {
      lastResponse.value = null
      initialTopic.value = null
      contextContinuationCount.value = 0
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

        // Set up a one-time hook to remove the prompt message immediately after it's composed
        let hookRemoved = false
        const removePromptHook = async () => {
          if (hookRemoved)
            return

          // Find and remove the user message we just added
          await nextTick()
          const userMessageIndex = chatStore.messages.findLastIndex(msg => msg.role === 'user')
          if (userMessageIndex !== -1 && userMessageIndex >= initialHistoryLength) {
            chatStore.messages.splice(userMessageIndex, 1)
            console.info(`[IdleTalk] Removed idle talk prompt immediately at index ${userMessageIndex}`)
          }

          hookRemoved = true
        }

        // Register the hook before sending
        chatStore.onAfterMessageComposed(removePromptHook)

        // Send the topic as a user message
        // This will trigger all the necessary pipelines (TTS, etc.)
        // Knowledge DB integration will check isCurrentlyIdleTalking and skip the query
        await chatStore.send(userPrompt, {
          model: llmModel,
          chatProvider: providerInstance as ChatProvider,
          providerConfig,
        })

        // Wait for the assistant's response to be added to chat history
        // Poll the chat history until we see the assistant response
        // Note: We don't look for user message anymore since it was already removed by the hook
        const maxWaitTime = 30000 // 30 seconds max wait
        const pollInterval = 100 // Check every 100ms
        const startTime = Date.now()
        let assistantResponseFound = false

        while (!assistantResponseFound && Date.now() - startTime < maxWaitTime) {
          // Check if we have new assistant message
          // Since we removed the user message immediately, we only expect +1 (assistant)
          if (chatStore.messages.length > initialHistoryLength) {
            // Look for the assistant's response
            const newMessages = chatStore.messages.slice(initialHistoryLength)
            const hasAssistantResponse = newMessages.some(msg => msg.role === 'assistant')

            if (hasAssistantResponse) {
              assistantResponseFound = true
              console.info(`[IdleTalk] Assistant response detected after ${Date.now() - startTime}ms`)
              break
            }
          }

          // Wait before next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }

        if (!assistantResponseFound) {
          console.warn(`[IdleTalk] Timeout waiting for assistant response after ${maxWaitTime}ms`)
        }

        console.info(`[IdleTalk] Chat history length: ${chatStore.messages.length}`)
        console.info(`[IdleTalk] Last 3 messages:`, chatStore.messages.slice(-3).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 50) : 'non-string' })))

        // Note: lastResponse will be stored by onAssistantResponseEnd hook
        // No need to store it here

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

      console.info(`[IdleTalk] Selected random topic from ${selectedTopic.author}: ${selectedTopic.content.substring(0, 50)}...`)

      return selectedTopic
    }
    catch (error) {
      console.error('[IdleTalk] Error fetching random topic:', error)
      return null
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
    if (config.continueContext
      && lastResponse.value
      && contextContinuationCount.value < config.maxContextContinuation) {
      console.info('[IdleTalk] Building continuation prompt')
      console.info(`[IdleTalk] Continuation count: ${contextContinuationCount.value + 1}/${config.maxContextContinuation}`)
      console.info(`[IdleTalk] Previous response: ${lastResponse.value.substring(0, 50)}...`)

      // Search for related knowledge to enrich the continuation
      let relatedKnowledge = ''
      try {
        const relatedResults = await knowledgeDB.queryKnowledge(lastResponse.value, {
          limit: 3,
          threshold: 0.6,
        })

        if (relatedResults && relatedResults.results.length > 0) {
          console.info(`[IdleTalk] Found ${relatedResults.results.length} related knowledge items`)
          relatedKnowledge = `\n【あなたの関連する過去の発言】\n${
            relatedResults.results
              .map(k => `- ${k.content.substring(0, 100)}${k.content.length > 100 ? '...' : ''}`)
              .join('\n')
          }\n`
        }
      }
      catch (error) {
        console.warn('[IdleTalk] Failed to fetch related knowledge, continuing without it', error)
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

    // Reset context when max continuation is reached
    if (contextContinuationCount.value >= config.maxContextContinuation) {
      console.info('[IdleTalk] Max context continuation reached, resetting to new topic')
      lastResponse.value = null
      initialTopic.value = null
      contextContinuationCount.value = 0
    }

    // Start with a new random topic
    const topic = await getRandomTopic()

    if (!topic) {
      return null
    }

    // Store initial topic for drift detection (future use)
    initialTopic.value = topic.content
    contextContinuationCount.value = 0

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
      lastResponse.value = null
      initialTopic.value = null
      contextContinuationCount.value = 0
      console.info('[IdleTalk] User input detected, cleared previous topic context')
    }, { persistent: true })

    // Register hook to reset timer after assistant response completes
    // This ensures we wait for the full response (including TTS) before starting idle timer
    // Both user topics and idle talk topics are treated the same way
    chatStore.onAssistantResponseEnd(async (fullText: string) => {
      console.info('[IdleTalk] Assistant response ended, storing response for continuation')

      // Store the assistant's response for topic continuation
      lastResponse.value = fullText
      console.info(`[IdleTalk] Stored response: ${fullText.substring(0, 50)}...`)

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
