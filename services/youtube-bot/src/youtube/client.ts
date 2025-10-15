import type { youtube_v3 } from 'googleapis'

import { google } from 'googleapis'

/**
 * YouTube client using API Key authentication
 * Requires YOUTUBE_VIDEO_ID to be set in environment variables
 */
export class YouTubeClient {
  private youtube: youtube_v3.Youtube

  constructor(apiKey: string) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    })
  }

  /**
   * Get live chat ID from video ID
   * Works for both active and upcoming broadcasts
   */
  async getLiveChatId(videoId: string): Promise<string | null> {
    const response = await this.youtube.videos.list({
      part: ['liveStreamingDetails'],
      id: [videoId],
    })

    const liveChatId = response.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId

    if (!liveChatId) {
      return null
    }

    return liveChatId
  }

  /**
   * Get video title and status
   */
  async getVideoInfo(videoId: string): Promise<{
    title: string
    status: string
  } | null> {
    const response = await this.youtube.videos.list({
      part: ['snippet', 'liveStreamingDetails'],
      id: [videoId],
    })

    const item = response.data.items?.[0]
    if (!item) {
      return null
    }

    return {
      title: item.snippet?.title || 'Unknown',
      status: item.snippet?.liveBroadcastContent || 'none',
    }
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
   * Note: This requires OAuth authentication and won't work with API Key only
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
