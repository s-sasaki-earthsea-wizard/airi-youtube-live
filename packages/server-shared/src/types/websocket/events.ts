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

export interface ShogiGameInfo {
  title?: string
  black?: string
  white?: string
  date?: string
  /** Which side the character plays as (commentary perspective) */
  ownSide?: '先手' | '後手'
}

export interface Shogi {
  /** Kind of shogi event: a single move, game start, or game end */
  kind: 'move' | 'gameStart' | 'gameEnd'
  /** Move number (1-indexed), for kind === 'move' */
  moveNumber?: number
  /** Player who made the move, for kind === 'move' */
  player?: '先手' | '後手'
  /** Move notation in Japanese (e.g., "７六歩"), for kind === 'move' */
  move?: string
  /** Whether this move was made by the character's side, for kind === 'move' */
  isOwnMove?: boolean
  /** Game phase, for kind === 'move' */
  phase?: '序盤' | '中盤' | '終盤'
  /** Annotation attached to the move in the kifu (e.g., opening/castle name) */
  comment?: string
  /** Game metadata, for kind === 'gameStart' */
  gameInfo?: ShogiGameInfo
  /** Game result text (e.g., "109手で先手の勝ち"), for kind === 'gameEnd' */
  result?: string
}

interface InputSource {
  browser: string
  discord: Discord
  youtube: YouTube
  shogi: Shogi
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
  'module:announced': {
    name: string
    index?: number
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
  } & Partial<WithInputSource<'browser' | 'discord' | 'youtube' | 'shogi'>>
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
