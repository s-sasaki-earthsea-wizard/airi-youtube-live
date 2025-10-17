import type { Client as AiriClient } from '@proj-airi/server-sdk'

import type { YouTubeLiveChatMessage } from '../types'

import { useLogg } from '@guiiai/logg'

const log = useLogg('MessageHandler').useGlobalConfig()

/**
 * Message Handler for YouTube Live Chat
 *
 * Simplified handler that only forwards messages to stage-web via AIRI Server.
 * LLM response generation and TTS are now handled by stage-web.
 */
export class MessageHandler {
  private airiClient: AiriClient

  constructor(airiClient: AiriClient) {
    this.airiClient = airiClient
  }

  /**
   * Handle incoming YouTube chat message
   * Forwards the message to stage-web for processing
   */
  async handleMessage(chatMessage: YouTubeLiveChatMessage): Promise<void> {
    log
      .withField('author', chatMessage.authorName)
      .withField('message', chatMessage.message)
      .withField('type', chatMessage.type)
      .log('Processing YouTube chat message')

    try {
      // Forward YouTube comment to stage-web (for chat display and LLM processing)
      this.airiClient.send({
        type: 'input:text',
        data: {
          text: chatMessage.message,
          author: chatMessage.authorName,
          source: 'youtube',
          timestamp: chatMessage.timestamp,
          youtube: {
            messageType: chatMessage.type,
            superChatDetails: chatMessage.superChatDetails,
          },
        },
      })

      log
        .withField('messageId', chatMessage.id)
        .log('Message forwarded to AIRI Server')
    }
    catch (error) {
      log.withError(error).error('Failed to forward message to AIRI Server')
    }
  }
}
