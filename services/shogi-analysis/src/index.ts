#!/usr/bin/env node

import process from 'node:process'

import { generateCommentary } from './commentary'
import { KifuParser } from './core/kifu-parser'

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
