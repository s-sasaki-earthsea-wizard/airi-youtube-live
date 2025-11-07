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
 * A single move in the game
 */
export interface Move {
  /** Move number (1-indexed) */
  moveNumber: number
  /** Player who made the move */
  player: '先手' | '後手'
  /** Move notation in Japanese (e.g., "７六歩") */
  move: string
  /** Time spent on this move (optional) */
  timeSpent?: string
  /** Comments or annotations for this move (optional) */
  comment?: string
}

/**
 * Supported kifu file formats
 */
export type KifuFormat = 'kif' | 'ki2' | 'csa'
