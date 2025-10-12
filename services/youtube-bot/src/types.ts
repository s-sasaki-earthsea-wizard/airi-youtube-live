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

export interface BotConfig {
  youtube: YouTubeAuthConfig
  llm: {
    provider: string
    model: string
    apiKey: string
  }
  tts: {
    provider: string
    model: string
    voice: string
    apiKey: string
  }
  outputDir: string
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
