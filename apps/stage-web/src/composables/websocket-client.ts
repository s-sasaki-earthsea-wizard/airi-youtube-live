import { Client as AiriClient } from '@proj-airi/server-sdk'
import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'

// Global singleton instance
let airiClientInstance: AiriClient | null = null
let isInitialized = false

export function useWebSocketClient() {
  // Return existing instance if already initialized
  if (isInitialized && airiClientInstance) {
    console.info('[WebSocket] Reusing existing AIRI Client instance')
    return { airiClient: airiClientInstance }
  }

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

  const chatStore = useChatStore()
  const providersStore = useProvidersStore()
  console.info('[WebSocket] Stores loaded')

  console.info('[WebSocket] Stores initialized')

  // Receive text input from YouTube/Discord/Telegram (user comments)
  airiClient.onEvent('input:text', async (event) => {
    const { text, author, source } = event.data

    console.info('[WebSocket] Received input:text event:', { text, author, source })

    try {
      // Add user message to chat store
      // Include author if available
      const content = author ? `${author}: ${text}` : text

      chatStore.messages.push({
        role: 'user',
        content,
      })

      // Automatically generate AI response if enabled
      if (autoResponseEnabled) {
        console.info('[WebSocket] Auto-response enabled, generating AI response...')

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
    }
    catch (error) {
      console.error('[WebSocket] Error handling input:text:', error)
    }
  })

  // Save as singleton instance
  airiClientInstance = airiClient
  isInitialized = true

  console.info('[WebSocket] AIRI Client initialization complete')

  return { airiClient }
}
