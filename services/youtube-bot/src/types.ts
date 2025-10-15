import type { youtube_v3 } from 'googleapis'

export interface YouTubeLiveChatMessage {
  id: string
  authorName: string
  authorChannelId: string
  message: string
  timestamp: string
  type: 'text' | 'super_chat' | 'super_sticker' | 'membership'
  superChatDetails?: {
    amountMicros: string
    currency: string
    tier: number
  }
}

export interface LiveChatPollerConfig {
  liveChatId: string
  pollingIntervalMs: number
  maxMessagesPerPoll: number
  onMessage: (message: YouTubeLiveChatMessage) => Promise<void>
  onError: (error: Error) => void
}

export interface YouTubeAuthConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export interface YouTubeSimpleConfig {
  apiKey: string
  videoId: string
}

export interface AiriConfig {
  url: string
  token: string
}

export interface BotConfig {
  youtube: YouTubeSimpleConfig
  pollingIntervalMs: number
  maxMessagesPerPoll: number
}

export interface LiveBroadcast {
  id: string
  title: string
  liveChatId: string
  status: 'active' | 'upcoming' | 'complete'
}

// Re-export YouTube API types
export type LiveChatMessage = youtube_v3.Schema$LiveChatMessage
export type LiveBroadcastListResponse = youtube_v3.Schema$LiveBroadcastListResponse
