import type { Logg } from '@guiiai/logg'

import type { LiveChatPollerConfig, YouTubeLiveChatMessage } from '../types'
import type { YouTubeClient } from './client'

export class LiveChatPoller {
  private config: LiveChatPollerConfig
  private client: YouTubeClient
  private logger: Logg
  private isRunning: boolean = false
  private pollingTimeout?: NodeJS.Timeout
  private nextPageToken?: string
  private processedMessageIds: Set<string> = new Set()

  constructor(
    client: YouTubeClient,
    config: LiveChatPollerConfig,
    logger: Logg,
  ) {
    this.client = client
    this.config = config
    this.logger = logger
  }

  /**
   * Start polling for live chat messages
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Poller is already running')
      return
    }

    this.isRunning = true
    this.logger.log('Starting live chat poller')
    this.poll()
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout)
      this.pollingTimeout = undefined
    }
    this.logger.log('Stopped live chat poller')
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      const result = await this.client.getLiveChatMessages(
        this.config.liveChatId,
        this.nextPageToken,
      )

      // Update page token for next request
      this.nextPageToken = result.nextPageToken

      // Process new messages
      const newMessages = this.filterNewMessages(result.messages)
      await this.processMessages(newMessages)

      // Use YouTube's recommended polling interval, or fall back to config
      const pollingInterval = result.pollingIntervalMillis || this.config.pollingIntervalMs

      // Schedule next poll
      this.pollingTimeout = setTimeout(() => {
        this.poll()
      }, pollingInterval)
    }
    catch (error) {
      this.logger
        .withError(error as Error)
        .error('Error polling live chat messages')

      this.config.onError(error as Error)

      // Retry after a longer interval on error
      this.pollingTimeout = setTimeout(() => {
        this.poll()
      }, this.config.pollingIntervalMs * 2)
    }
  }

  /**
   * Filter out messages we've already processed
   */
  private filterNewMessages(messages: any[]): any[] {
    return messages.filter((msg) => {
      if (!msg.id) {
        return false
      }

      if (this.processedMessageIds.has(msg.id)) {
        return false
      }

      this.processedMessageIds.add(msg.id)

      // Clean up old message IDs to prevent memory leak
      // Keep only the last 1000 message IDs
      if (this.processedMessageIds.size > 1000) {
        const oldestIds = Array.from(this.processedMessageIds).slice(0, 100)
        oldestIds.forEach(id => this.processedMessageIds.delete(id))
      }

      return true
    })
  }

  /**
   * Process messages and call handler for each
   */
  private async processMessages(messages: any[]): Promise<void> {
    for (const msg of messages) {
      try {
        const message = this.transformMessage(msg)
        if (message) {
          await this.config.onMessage(message)
        }
      }
      catch (error) {
        this.logger
          .withError(error as Error)
          .withField('messageId', msg.id)
          .error('Error processing message')
      }
    }
  }

  /**
   * Transform YouTube API message to our internal format
   */
  private transformMessage(msg: any): YouTubeLiveChatMessage | null {
    if (!msg.snippet || !msg.authorDetails) {
      return null
    }

    const snippet = msg.snippet
    const author = msg.authorDetails

    // Determine message type
    let type: YouTubeLiveChatMessage['type'] = 'text'
    let superChatDetails: YouTubeLiveChatMessage['superChatDetails']

    if (snippet.type === 'superChatEvent') {
      type = 'super_chat'
      superChatDetails = {
        amountMicros: snippet.superChatDetails?.amountMicros || '0',
        currency: snippet.superChatDetails?.currency || 'USD',
        tier: snippet.superChatDetails?.tier || 0,
      }
    }
    else if (snippet.type === 'superStickerEvent') {
      type = 'super_sticker'
      superChatDetails = {
        amountMicros: snippet.superStickerDetails?.amountMicros || '0',
        currency: snippet.superStickerDetails?.currency || 'USD',
        tier: snippet.superStickerDetails?.tier || 0,
      }
    }
    else if (snippet.type === 'newSponsorEvent' || snippet.type === 'memberMilestoneChatEvent') {
      type = 'membership'
    }

    return {
      id: msg.id,
      authorName: author.displayName || 'Unknown',
      authorChannelId: author.channelId || '',
      message: snippet.textMessageDetails?.messageText
        || snippet.superChatDetails?.userComment
        || snippet.superStickerDetails?.userComment
        || '',
      timestamp: snippet.publishedAt || new Date().toISOString(),
      type,
      superChatDetails,
    }
  }
}
