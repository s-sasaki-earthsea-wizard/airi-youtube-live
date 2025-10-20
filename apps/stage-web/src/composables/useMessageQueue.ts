/**
 * Message Queue Composable
 *
 * Manages a queue of incoming messages to prevent interruption during speech playback.
 * When the character is speaking, new messages are queued and processed after speech ends.
 *
 * Features:
 * - Queue messages during speech playback
 * - Process queued messages sequentially after speech ends
 * - Prevent message loss while maintaining conversation flow
 */

import { useSpeakingStore } from '@proj-airi/stage-ui/stores/audio'
import { ref, watch } from 'vue'

export interface QueuedMessage {
  text: string
  author?: string
  source?: string
  timestamp: number
}

const messageQueue = ref<QueuedMessage[]>([])
const isProcessing = ref(false)

export function useMessageQueue() {
  const speakingStore = useSpeakingStore()

  /**
   * Add message to queue
   * @param message - Message to queue
   */
  function enqueue(message: Omit<QueuedMessage, 'timestamp'>) {
    const queuedMessage: QueuedMessage = {
      ...message,
      timestamp: Date.now(),
    }
    messageQueue.value.push(queuedMessage)
    console.info(`[MessageQueue] Message queued (${messageQueue.value.length} in queue):`, {
      text: message.text.substring(0, 50),
      author: message.author,
      source: message.source,
    })
  }

  /**
   * Get next message from queue
   * @returns Next message or null if queue is empty
   */
  function dequeue(): QueuedMessage | null {
    const message = messageQueue.value.shift()
    if (message) {
      console.info(`[MessageQueue] Dequeued message (${messageQueue.value.length} remaining):`, {
        text: message.text.substring(0, 50),
        author: message.author,
        source: message.source,
        queuedDuration: Date.now() - message.timestamp,
      })
    }
    return message || null
  }

  /**
   * Check if currently speaking
   * @returns True if character is speaking
   */
  function isSpeaking(): boolean {
    return speakingStore.nowSpeaking
  }

  /**
   * Check if should queue message
   * Messages should be queued if:
   * 1. Character is currently speaking, OR
   * 2. A message is currently being processed
   *
   * @returns True if message should be queued
   */
  function shouldQueue(): boolean {
    const speaking = isSpeaking()
    const processing = isProcessing.value

    if (speaking || processing) {
      console.info('[MessageQueue] Should queue:', { speaking, processing })
      return true
    }

    return false
  }

  /**
   * Mark message processing as started
   */
  function startProcessing() {
    isProcessing.value = true
    console.info('[MessageQueue] Started processing message')
  }

  /**
   * Mark message processing as completed
   */
  function endProcessing() {
    isProcessing.value = false
    console.info('[MessageQueue] Ended processing message')
  }

  /**
   * Get current queue size
   * @returns Number of messages in queue
   */
  function size(): number {
    return messageQueue.value.length
  }

  /**
   * Clear all queued messages
   */
  function clear() {
    const count = messageQueue.value.length
    messageQueue.value = []
    console.info(`[MessageQueue] Cleared ${count} messages from queue`)
  }

  /**
   * Watch for speech end to process next queued message
   * This is called by the auto-response system after setting up the message processor
   */
  function watchSpeechEnd(processMessage: (message: QueuedMessage) => Promise<void>) {
    watch(() => speakingStore.nowSpeaking, async (nowSpeaking, wasSpeaking) => {
      // Trigger when speech transitions from speaking to not speaking
      if (wasSpeaking && !nowSpeaking && !isProcessing.value) {
        console.info('[MessageQueue] Speech ended, checking queue...')

        // Process next message if available
        const nextMessage = dequeue()
        if (nextMessage) {
          console.info('[MessageQueue] Processing next queued message')
          try {
            startProcessing()
            await processMessage(nextMessage)
          }
          catch (error) {
            console.error('[MessageQueue] Error processing queued message:', error)
          }
          finally {
            endProcessing()
          }
        }
        else {
          console.info('[MessageQueue] No messages in queue')
        }
      }
    })
  }

  return {
    enqueue,
    dequeue,
    isSpeaking,
    shouldQueue,
    startProcessing,
    endProcessing,
    size,
    clear,
    watchSpeechEnd,
  }
}
