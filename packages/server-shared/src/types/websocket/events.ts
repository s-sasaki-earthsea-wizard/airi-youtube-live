export interface DiscordGuildMember {
  nickname: string
  displayName: string
  id: string
}

export interface Discord {
  guildMember?: DiscordGuildMember
  guildId?: string
  channelId?: string
}

export interface YouTube {
  messageType?: 'text' | 'super_chat' | 'super_sticker' | 'membership'
  superChatDetails?: {
    amountMicros: string
    currency: string
    tier: number
  }
}

interface InputSource {
  browser: string
  discord: Discord
  youtube: YouTube
}

export interface WebSocketBaseEvent<T, D> {
  type: T
  data: D
}

export type WithInputSource<Source extends keyof InputSource> = {
  [S in Source]: InputSource[S]
}

// Thanks to:
//
// A little hack for creating extensible discriminated unions : r/typescript
// https://www.reddit.com/r/typescript/comments/1064ibt/a_little_hack_for_creating_extensible/
export interface WebSocketEvents<C = undefined> {
  'error': {
    message: string
  }
  'module:authenticate': {
    token: string
  }
  'module:authenticated': {
    authenticated: boolean
  }
  'module:announce': {
    name: string
    possibleEvents: Array<(keyof WebSocketEvents<C>)>
  }
  'module:configure': {
    config: C
  }
  'ui:configure': {
    moduleName: string
    moduleIndex?: number
    config: C | Record<string, unknown>
  }
  'input:text': {
    text: string
    author?: string
    source?: string
    timestamp?: string
  } & Partial<WithInputSource<'browser' | 'discord' | 'youtube'>>
  'input:text:voice': {
    transcription: string
  } & Partial<WithInputSource<'browser' | 'discord' | 'youtube'>>
  'input:voice': {
    audio: ArrayBuffer
  } & Partial<WithInputSource<'browser' | 'discord' | 'youtube'>>
}

export type WebSocketEvent<C = undefined> = {
  [K in keyof WebSocketEvents<C>]: WebSocketBaseEvent<K, WebSocketEvents<C>[K]>;
}[keyof WebSocketEvents<C>]
