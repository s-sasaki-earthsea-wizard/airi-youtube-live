import type { OAuth2Client } from 'google-auth-library'
import type { youtube_v3 } from 'googleapis'

import type { LiveBroadcast, YouTubeAuthConfig } from '../types'

import { google } from 'googleapis'

import { createOAuth2Client } from './auth'

export class YouTubeClient {
  private oauth2Client: OAuth2Client
  private youtube: youtube_v3.Youtube

  constructor(config: YouTubeAuthConfig) {
    this.oauth2Client = createOAuth2Client(config)
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    })
  }

  /**
   * Get all active live broadcasts for the authenticated channel
   */
  async getActiveLiveBroadcasts(): Promise<LiveBroadcast[]> {
    const response = await this.youtube.liveBroadcasts.list({
      part: ['snippet', 'status'],
      broadcastStatus: 'active',
      mine: true,
    })

    if (!response.data.items || response.data.items.length === 0) {
      return []
    }

    return response.data.items
      .filter(item => item.snippet?.liveChatId)
      .map(item => ({
        id: item.id!,
        title: item.snippet!.title!,
        liveChatId: item.snippet!.liveChatId!,
        status: 'active' as const,
      }))
  }

  /**
   * Get upcoming live broadcasts
   */
  async getUpcomingLiveBroadcasts(): Promise<LiveBroadcast[]> {
    const response = await this.youtube.liveBroadcasts.list({
      part: ['snippet', 'status'],
      broadcastStatus: 'upcoming',
      mine: true,
    })

    if (!response.data.items || response.data.items.length === 0) {
      return []
    }

    return response.data.items
      .filter(item => item.snippet?.liveChatId)
      .map(item => ({
        id: item.id!,
        title: item.snippet!.title!,
        liveChatId: item.snippet!.liveChatId!,
        status: 'upcoming' as const,
      }))
  }

  /**
   * Get live chat messages
   */
  async getLiveChatMessages(
    liveChatId: string,
    pageToken?: string,
  ): Promise<{
    messages: youtube_v3.Schema$LiveChatMessage[]
    nextPageToken?: string
    pollingIntervalMillis?: number
  }> {
    const response = await this.youtube.liveChatMessages.list({
      liveChatId,
      part: ['snippet', 'authorDetails'],
      pageToken,
    })

    return {
      messages: response.data.items || [],
      nextPageToken: response.data.nextPageToken || undefined,
      pollingIntervalMillis: response.data.pollingIntervalMillis || undefined,
    }
  }

  /**
   * Send a message to the live chat (optional feature)
   */
  async sendLiveChatMessage(liveChatId: string, message: string): Promise<void> {
    await this.youtube.liveChatMessages.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: message,
          },
        },
      },
    })
  }
}
