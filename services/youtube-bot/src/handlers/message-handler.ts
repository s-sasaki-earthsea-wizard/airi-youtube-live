import type { Client as AiriClient } from '@proj-airi/server-sdk'

import type { FilterConfig } from '../filters/comment-filter'
import type { YouTubeLiveChatMessage } from '../types'

import process from 'node:process'

import { useLogg } from '@guiiai/logg'

import { CommentFilter } from '../filters/comment-filter'

const log = useLogg('MessageHandler').useGlobalConfig()

/**
 * Message Handler for YouTube Live Chat
 *
 * Simplified handler that only forwards messages to stage-web via AIRI Server.
 * LLM response generation and TTS are now handled by stage-web.
 */
export class MessageHandler {
  private airiClient: AiriClient
  private commentFilter: CommentFilter

  constructor(airiClient: AiriClient) {
    this.airiClient = airiClient

    // Initialize comment filter from environment variables
    const filterConfig: FilterConfig = {
      enabled: process.env.COMMENT_FILTER_ENABLED === 'true',
      minLength: Number(process.env.COMMENT_FILTER_MIN_LENGTH) || 3,
      logFiltered: process.env.COMMENT_FILTER_LOG_FILTERED === 'true',
      customNoiseWords: process.env.COMMENT_FILTER_CUSTOM_NOISE_WORDS
        ?.split(',')
        .map(w => w.trim())
        .filter(Boolean),
    }

    this.commentFilter = new CommentFilter(filterConfig)
  }

  /**
   * Handle incoming YouTube chat message
   * Forwards the message to stage-web for processing
   */
  async handleMessage(chatMessage: YouTubeLiveChatMessage): Promise<void> {
    // Apply comment filter
    const filterResult = this.commentFilter.shouldRespond(chatMessage.message)

    if (!filterResult.shouldRespond) {
      log
        .withField('author', chatMessage.authorName)
        .withField('message', chatMessage.message)
        .withField('type', chatMessage.type)
        .withField('reason', filterResult.reason)
        .withField('matchedPattern', filterResult.matchedPattern)
        .log('Comment filtered out')
      return
    }

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
