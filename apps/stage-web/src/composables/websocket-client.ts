import { Client as AiriClient } from '@proj-airi/server-sdk'
import { useChatStore } from '@proj-airi/stage-ui/stores/chat'

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

  const airiClient = new AiriClient({
    name: 'stage-web',
    possibleEvents: ['input:text', 'output:text', 'output:audio'],
    url: airiUrl,
  })

  console.info('[WebSocket] AIRI Client created')

  const chatStore = useChatStore()
  console.info('[WebSocket] Chat store loaded')

  console.info('[WebSocket] Stores initialized')

  // Receive text input from YouTube/Discord/Telegram (user comments)
  airiClient.onEvent('input:text', async (event) => {
    const { text, author, source } = event.data

    console.info('[WebSocket] Received input:text event:', { text, author, source })

    try {
      // Add user message to chat store (display only, no LLM call)
      // Include author if available
      const content = author ? `${author}: ${text}` : text

      chatStore.messages.push({
        role: 'user',
        content,
      })
    }
    catch (error) {
      console.error('[WebSocket] Error handling input:text:', error)
    }
  })

  // Receive AI response text (for chat display)
  airiClient.onEvent('output:text', async (event) => {
    const { text, author, source } = event.data

    console.info('[WebSocket] Received output:text event:', { text, author, source })

    try {
      // Add AI response to chat store
      chatStore.messages.push({
        role: 'assistant',
        content: text,
        slices: [
          {
            type: 'text',
            text,
          },
        ],
        tool_results: [],
      })
    }
    catch (error) {
      console.error('[WebSocket] Error handling output:text:', error)
    }
  })

  // Receive AI response audio (for playback)
  airiClient.onEvent('output:audio', async (event) => {
    const { audioUrl, text } = event.data

    console.info('[WebSocket] Received output:audio event:', { audioUrl, text })

    try {
      // Auto-play audio
      const audio = new Audio(audioUrl)
      audio.play()
        .then(() => {
          console.info('[WebSocket] Audio playback started:', audioUrl)
        })
        .catch((err) => {
          console.error('[WebSocket] Audio playback failed:', err)
        })
    }
    catch (error) {
      console.error('[WebSocket] Error handling output:audio:', error)
    }
  })

  // Save as singleton instance
  airiClientInstance = airiClient
  isInitialized = true

  console.info('[WebSocket] AIRI Client initialization complete')

  return { airiClient }
}
