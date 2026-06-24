import type { GamePhase } from './types'

/**
 * Move number thresholds that separate the game phases.
 * Kept here so every consumer (parser, commentary) derives the phase the same way.
 */
const OPENING_LAST_MOVE = 30
const MIDGAME_LAST_MOVE = 80

/**
 * Derive the game phase from a 1-indexed move number.
 * @param moveNumber - The move number (1-indexed)
 * @returns The game phase
 */
export function getGamePhase(moveNumber: number): GamePhase {
  if (moveNumber <= OPENING_LAST_MOVE)
    return '序盤'
  if (moveNumber <= MIDGAME_LAST_MOVE)
    return '中盤'
  return '終盤'
}
