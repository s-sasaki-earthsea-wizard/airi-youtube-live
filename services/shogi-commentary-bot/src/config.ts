import { env } from 'node:process'

export interface BotConfig {
  /** AIRI Server WebSocket URL */
  airiServerUrl: string
  /** Optional authentication token for AIRI Server */
  airiServerToken?: string
  /** Path to the kifu file to commentate */
  kifuFile: string
  /** Which side the character plays as (commentary perspective) */
  ownSide: '先手' | '後手'
  /** Interval between moves in milliseconds */
  moveIntervalMs: number
  /** Max number of moves to send (0 = all) */
  maxMoves: number
}

/**
 * Load bot configuration from environment variables.
 * @returns Bot configuration
 */
export function loadConfig(): BotConfig {
  const ownSide = env.SHOGI_OWN_SIDE === '後手' ? '後手' : '先手'

  return {
    airiServerUrl: env.AIRI_SERVER_URL || 'ws://localhost:6121/ws',
    airiServerToken: env.AIRI_SERVER_TOKEN || undefined,
    kifuFile: env.KIFU_FILE || '../shogi-analysis/data/kifu/sample.kif',
    ownSide,
    moveIntervalMs: Number.parseInt(env.SHOGI_MOVE_INTERVAL_MS || '10000', 10),
    maxMoves: Number.parseInt(env.SHOGI_MAX_MOVES || '0', 10),
  }
}

export const LOG_LEVEL = env.LOG_LEVEL || 'log'
