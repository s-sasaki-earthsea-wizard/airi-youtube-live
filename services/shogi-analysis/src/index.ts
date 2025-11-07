#!/usr/bin/env node

import type { ParsedKifu } from './types'

import process from 'node:process'

import { KifuParser } from './core/kifu-parser'

/**
 * Generate simple commentary for a kifu
 * @param kifu - Parsed kifu data
 * @returns Array of commentary strings
 */
function generateCommentary(kifu: ParsedKifu): string[] {
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

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2)

  // Check arguments
  if (args.length === 0) {
    console.info('使用法: tsx src/index.ts <棋譜ファイル>')
    console.info('')
    console.info('例:')
    console.info('  tsx src/index.ts data/sample-kifu/example1.kif')
    console.info('  npm run analyze data/sample-kifu/example1.kif')
    console.info('')
    console.info('対応フォーマット: .kif, .ki2, .csa')
    process.exit(1)
  }

  const kifuPath = args[0]

  try {
    // Parse kifu file
    console.info(`棋譜ファイルを読み込んでいます: ${kifuPath}`)
    console.info('')

    const parser = new KifuParser()
    const kifu = await parser.parseFile(kifuPath)

    console.info('棋譜の解析が完了しました。')
    console.info(`手数: ${kifu.moves.length}`)
    if (kifu.header.black)
      console.info(`先手: ${kifu.header.black}`)
    if (kifu.header.white)
      console.info(`後手: ${kifu.header.white}`)
    console.info('')

    // Generate commentary
    const commentary = generateCommentary(kifu)

    // Output
    console.info('=== 対局実況 ===')
    console.info('')
    for (const line of commentary) {
      console.info(line)
    }
  }
  catch (error) {
    console.error('エラーが発生しました:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
