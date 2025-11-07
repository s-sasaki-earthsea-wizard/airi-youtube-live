import type { ParsedKifu } from './types'

/**
 * Generate simple commentary for a kifu
 * @param kifu - Parsed kifu data
 * @returns Array of commentary strings
 */
export function generateCommentary(kifu: ParsedKifu): string[] {
  const commentary: string[] = []

  // Opening
  const { black, white, tournament, date } = kifu.header
  let opening = ''

  if (tournament) {
    opening = tournament
  }

  if (black && white) {
    opening += opening ? '、' : ''
    opening += `${black}先手、${white}後手の対局`
  }

  if (date) {
    opening += `（${date}）`
  }

  if (opening) {
    commentary.push(`${opening}が始まりました。`)
  }
  else {
    commentary.push('対局が始まりました。')
  }

  commentary.push('') // Empty line

  // Moves
  for (const move of kifu.moves) {
    const { moveNumber, player, move: moveStr } = move

    // First move
    if (moveNumber === 1) {
      commentary.push(`初手は${moveStr}です。`)
      commentary.push('')
      continue
    }

    // Every 10 moves in opening (1-30)
    if (moveNumber <= 30 && moveNumber % 10 === 0) {
      commentary.push(`${moveNumber}手目、${player}は${moveStr}と指しました。序盤の駆け引きが続きます。`)
      commentary.push('')
      continue
    }

    // Every 15 moves in middlegame (31-80)
    if (moveNumber > 30 && moveNumber <= 80 && moveNumber % 15 === 0) {
      commentary.push(`${moveNumber}手目、${player}、${moveStr}。中盤戦に入っています。`)
      commentary.push('')
      continue
    }

    // Every 10 moves in endgame (81+)
    if (moveNumber > 80 && moveNumber % 10 === 0) {
      commentary.push(`${moveNumber}手目、${player}、${moveStr}と寄せに出ました。終盤戦です。`)
      commentary.push('')
    }
  }

  // Closing
  const totalMoves = kifu.moves.length
  commentary.push(`まで${totalMoves}手で対局終了です。お疲れ様でした。`)

  return commentary
}
