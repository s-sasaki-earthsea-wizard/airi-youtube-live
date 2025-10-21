import type { QueuedMessage } from './useMessageQueue'

import { Client as AiriClient } from '@proj-airi/server-sdk'
import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'

import { useMessageQueue } from './useMessageQueue'

// Global singleton instance
let airiClientInstance: AiriClient | null = null
let isInitialized = false
let eventListenersRegistered = false

export function useWebSocketClient() {
  // Create client if not initialized
  if (!isInitialized || !airiClientInstance) {
    console.info('[WebSocket] Creating AIRI Client...')

    const airiUrl = import.meta.env.VITE_AIRI_URL || 'ws://localhost:6121/ws'
    console.info('[WebSocket] Connecting to:', airiUrl)

    // Check if auto-response is enabled
    const autoResponseEnabled = import.meta.env.VITE_AUTO_RESPONSE_ENABLED === 'true'
    console.info('[WebSocket] Auto-response mode:', autoResponseEnabled ? 'enabled' : 'disabled')

    const airiClient = new AiriClient({
      name: 'stage-web',
      possibleEvents: ['input:text'],
      url: airiUrl,
    })

    console.info('[WebSocket] AIRI Client created')

    // Save as singleton instance
    airiClientInstance = airiClient
    isInitialized = true

    console.info('[WebSocket] AIRI Client initialization complete')
  }
  else {
    console.info('[WebSocket] Reusing existing AIRI Client instance')
  }

  // Register event listeners only once
  if (!eventListenersRegistered && airiClientInstance) {
    console.info('[WebSocket] Registering event listeners...')

    const chatStore = useChatStore()
    const providersStore = useProvidersStore()
    console.info('[WebSocket] Stores loaded')

    // Check if auto-response is enabled
    const autoResponseEnabled = import.meta.env.VITE_AUTO_RESPONSE_ENABLED === 'true'

    // Initialize message queue system
    const messageQueue = useMessageQueue()

    /**
     * Process a message and generate AI response
     * Extracted as a separate function to be reused by queue system
     */
    async function processMessage(message: QueuedMessage) {
      const { text } = message

      try {
        // Get LLM provider and model from environment variables
        const llmProvider = import.meta.env.VITE_LLM_PROVIDER
        const llmModel = import.meta.env.VITE_LLM_MODEL

        if (!llmProvider || !llmModel) {
          console.warn('[WebSocket] No LLM provider or model configured in environment variables, skipping auto-response')
          console.warn('[WebSocket] Set VITE_LLM_PROVIDER and VITE_LLM_MODEL in .env file')
          return
        }

        console.info('[WebSocket] Using provider:', llmProvider, 'model:', llmModel)

        // Get the provider instance
        const providerInstance = await providersStore.getProviderInstance(llmProvider)
        if (!providerInstance) {
          console.error('[WebSocket] Failed to get provider instance for:', llmProvider)
          return
        }

        // Ensure the provider is a ChatProvider
        if (!('chat' in providerInstance)) {
          console.error('[WebSocket] Provider is not a ChatProvider:', llmProvider)
          return
        }

        const providerConfig = providersStore.getProviderConfig(llmProvider)

        // Trigger AI response generation
        await chatStore.send(text, {
          model: llmModel,
          chatProvider: providerInstance,
          providerConfig,
        })

        console.info('[WebSocket] AI response generated successfully')
      }
      catch (error) {
        console.error('[WebSocket] Error processing message:', error)
      }
    }

    // Setup watch for speech end to process queued messages
    if (autoResponseEnabled) {
      messageQueue.watchSpeechEnd(processMessage)
      console.info('[WebSocket] Message queue watching for speech end')
    }

    // Receive text input from YouTube/Discord/Telegram (user comments)
    airiClientInstance.onEvent('input:text', async (event) => {
      const { text, author, source } = event.data

      console.info('[WebSocket] Received input:text event:', { text, author, source })

      try {
        // Always add user message to chat store with author information
        chatStore.messages.push({
          role: 'user',
          content: text,
          author,
          source,
        })

        // Automatically generate AI response if enabled
        if (autoResponseEnabled) {
          console.info('[WebSocket] Auto-response enabled')

          // Check if we should queue this message
          if (messageQueue.shouldQueue()) {
            console.info('[WebSocket] Character is speaking or processing, queueing message')
            messageQueue.enqueue({ text, author, source })
          }
          else {
            // Process immediately if not speaking
            console.info('[WebSocket] Processing message immediately')
            messageQueue.startProcessing()
            try {
              await processMessage({ text, author, source, timestamp: Date.now() })
            }
            finally {
              messageQueue.endProcessing()
            }
          }
        }
      }
      catch (error) {
        console.error('[WebSocket] Error handling input:text:', error)
      }
    })

    eventListenersRegistered = true
    console.info('[WebSocket] Event listeners registered')
  }

  return { airiClient: airiClientInstance! }
}
