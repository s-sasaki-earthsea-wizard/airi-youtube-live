/**
 * Parsed kifu (game record) data structure
 */
export interface ParsedKifu {
  /** Game metadata from kifu header */
  header: KifuHeader
  /** List of moves in the game */
  moves: Move[]
}

/**
 * Kifu header information
 */
export interface KifuHeader {
  /** Tournament or event name (e.g., "竜王戦") */
  title?: string
  /** Black/Sente player name (e.g., "藤井聡太") */
  black?: string
  /** White/Gote player name (e.g., "羽生善治") */
  white?: string
  /** Game date */
  date?: string
  /** Tournament name */
  tournament?: string
  /** Game result */
  result?: string
}

/**
 * Game phase derived from the move number
 */
export type GamePhase = '序盤' | '中盤' | '終盤'

/**
 * A single move in the game
 */
export interface Move {
  /** Move number (1-indexed) */
  moveNumber: number
  /** Player who made the move */
  player: '先手' | '後手'
  /** Move notation in Japanese (e.g., "７六歩") */
  move: string
  /** Hiragana reading of the move for TTS (e.g., "ななろくふ") */
  reading: string
  /** Game phase derived from the move number */
  phase: GamePhase
  /** Time spent on this move (optional) */
  timeSpent?: string
  /** Comments or annotations for this move (optional) */
  comment?: string
}

/**
 * A move enriched for roleplay commentary, where the streamer character
 * impersonates one side of the game ("own move" vs "opponent move").
 *
 * This is the structured payload the future commentary bot will hand to
 * stage-web; the roleplay prototype generates the line from the same data.
 */
export interface RoleplayMove extends Move {
  /** Whether this move was played by the side the character impersonates */
  isOwnMove: boolean
  /** Generated character line for this move (filled by the roleplay flow) */
  commentary?: string
}

/**
 * Supported kifu file formats
 */
export type KifuFormat = 'kif' | 'ki2' | 'csa'
