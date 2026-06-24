#!/usr/bin/env node

import type { OwnSide, RoleplayCommentaryResult } from './roleplay-commentary'
import type { ParsedKifu } from './types'

import process from 'node:process'

import { generateCommentary } from './commentary'
import { loadLLMConfig } from './config'
import { KifuParser } from './core/kifu-parser'
import { LLMClient } from './llm-client'
import { generateLLMCommentary } from './llm-commentary'
import { generateRoleplayCommentary } from './roleplay-commentary'

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]) {
  const options = {
    kifuPath: '',
    useLLM: false,
    roleplay: false,
    side: undefined as OwnSide | undefined,
    maxMoves: 40,
    intervalMoves: 10,
    json: false,
    md: false,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--llm') {
      options.useLLM = true
    }
    else if (arg === '--roleplay') {
      options.roleplay = true
    }
    else if (arg === '--side' && i + 1 < args.length) {
      const value = args[++i].toLowerCase()
      if (value === 'sente')
        options.side = '先手'
      else if (value === 'gote')
        options.side = '後手'
      else
        console.error(`警告: --side は sente か gote を指定してください（指定値: ${value}）。自動判定にフォールバックします。`)
    }
    else if (arg === '--max-moves' && i + 1 < args.length) {
      options.maxMoves = Number.parseInt(args[++i], 10)
    }
    else if (arg === '--interval' && i + 1 < args.length) {
      options.intervalMoves = Number.parseInt(args[++i], 10)
    }
    else if (arg === '--json') {
      options.json = true
    }
    else if (arg === '--md') {
      options.md = true
    }
    else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    }
    else if (!arg.startsWith('-')) {
      options.kifuPath = arg
    }
  }

  return options
}

/**
 * Print roleplay commentary as human-readable text for visual review.
 */
function printRoleplayText(result: RoleplayCommentaryResult): void {
  console.info('=== なりきり実況 ===')
  console.info(`さめが指す側: ${result.ownSide}（${result.ownSideReason}）`)
  console.info('')
  console.info(`さめ: ${result.greeting}`)
  console.info('')

  for (const move of result.moves) {
    const role = move.isOwnMove ? '自分の手' : '相手の手'
    console.info(`【${move.moveNumber}手目】${move.player} ${move.move} 〔${role}・${move.phase}〕`)
    console.info(`さめ: ${move.commentary}`)
    console.info('')
  }
}

/**
 * Print roleplay commentary as a Markdown document, suitable for saving as a
 * sample transcript (e.g. `... --roleplay --md ... > sample.md`).
 */
function printRoleplayMarkdown(result: RoleplayCommentaryResult, kifu: ParsedKifu): void {
  const { header } = kifu
  const lines: string[] = []

  lines.push('# なりきり将棋実況サンプル（さめ）')
  lines.push('')
  lines.push('> ⚠️ **既知の課題**: このサンプルは盤面状態を保持せず、各手を「直前までの文脈＋その手の情報」だけで生成しています。')
  lines.push('> そのため駒の移動元を誤認したコメント（例: 別の駒の動きを「下げた」と解釈する等）が含まれます。')
  lines.push('> 盤面認識を導入する前の **改善前ベースライン** として保存したものです。')
  lines.push('')
  lines.push('## 対局情報')
  lines.push('')
  lines.push('| 項目 | 内容 |')
  lines.push('| --- | --- |')
  if (header.tournament || header.title)
    lines.push(`| 棋戦 | ${header.tournament || header.title} |`)
  lines.push(`| 先手 | ${header.black ?? '不明'}${result.ownSide === '先手' ? '（← さめがなりきり）' : ''} |`)
  lines.push(`| 後手 | ${header.white ?? '不明'}${result.ownSide === '後手' ? '（← さめがなりきり）' : ''} |`)
  if (header.date)
    lines.push(`| 対局日 | ${header.date} |`)
  lines.push(`| 手数 | ${kifu.moves.length}手 |`)
  lines.push('')
  lines.push('## 実況')
  lines.push('')
  lines.push('### 対局開始')
  lines.push('')
  lines.push(`> ${result.greeting}`)
  lines.push('')

  for (const move of result.moves) {
    const mark = move.player === '先手' ? '▲' : '△'
    const role = move.isOwnMove ? '自分の手' : '相手の手'
    lines.push(`### ${move.moveNumber}手目 ${mark}${move.move}（${move.reading}）〔${role}・${move.phase}〕`)
    lines.push('')
    lines.push(`> ${move.commentary ?? ''}`)
    lines.push('')
  }

  console.info(lines.join('\n'))
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2)

  // Check arguments
  if (args.length === 0) {
    console.info('使用法: tsx src/index.ts [オプション] <棋譜ファイル>')
    console.info('')
    console.info('オプション:')
    console.info('  --llm              LLMを使って解説者視点の実況を生成（デフォルト: テンプレートベース）')
    console.info('  --interval <N>     N手ごとにコメント生成（--llm時、デフォルト: 10）')
    console.info('  --roleplay         なりきり実況モード（さめが対局者の一方になりきり、1手ずつセリフ生成）')
    console.info('  --side <sente|gote> なりきる側を明示指定（省略時: 名前判定→先手）')
    console.info('  --max-moves <N>    なりきり実況で生成する手数の上限（デフォルト: 40）')
    console.info('  --json             なりきり実況の結果を構造化JSONで出力')
    console.info('  --md               なりきり実況をMarkdown文書で出力（サンプル保存用）')
    console.info('  --verbose, -v      詳細なログを表示')
    console.info('')
    console.info('例:')
    console.info('  tsx src/index.ts data/sample-kifu/example1.kif')
    console.info('  tsx src/index.ts --llm data/sample-kifu/example1.kif')
    console.info('  tsx src/index.ts --roleplay --max-moves 40 -v data/kifu/sample.kif')
    console.info('  tsx src/index.ts --roleplay --side sente --json data/kifu/sample.kif')
    console.info('')
    console.info('対応フォーマット: .kif, .ki2, .csa')
    process.exit(1)
  }

  const options = parseArgs(args)

  if (!options.kifuPath) {
    console.error('エラー: 棋譜ファイルを指定してください')
    process.exit(1)
  }

  try {
    // In roleplay JSON/Markdown mode, keep stdout clean for the document.
    const quiet = options.roleplay && (options.json || options.md)

    // Parse kifu file
    if (!quiet) {
      console.info(`棋譜ファイルを読み込んでいます: ${options.kifuPath}`)
      console.info('')
    }

    const parser = new KifuParser()
    const kifu = await parser.parseFile(options.kifuPath)

    if (!quiet) {
      console.info('棋譜の解析が完了しました。')
      console.info(`手数: ${kifu.moves.length}`)
      if (kifu.header.black)
        console.info(`先手: ${kifu.header.black}`)
      if (kifu.header.white)
        console.info(`後手: ${kifu.header.white}`)
      console.info('')
    }

    // Roleplay mode: character impersonates one side and narrates move by move.
    if (options.roleplay) {
      const config = loadLLMConfig()
      const llmClient = new LLMClient(config)

      if (!quiet) {
        console.info('なりきり実況モードでセリフを生成します...')
        console.info(`生成手数: 最大${options.maxMoves}手`)
        console.info('')
      }

      const result = await generateRoleplayCommentary(kifu, llmClient, config.model, {
        side: options.side,
        maxMoves: options.maxMoves,
        verbose: options.verbose,
      })

      if (options.json)
        console.info(JSON.stringify(result, null, 2))
      else if (options.md)
        printRoleplayMarkdown(result, kifu)
      else
        printRoleplayText(result)

      return
    }

    // Generate commentary
    let commentary: string[]

    if (options.useLLM) {
      console.info('LLMを使って実況コメントを生成します...')
      console.info(`コメント間隔: ${options.intervalMoves}手ごと`)
      console.info('')

      const config = loadLLMConfig()
      const llmClient = new LLMClient(config)

      commentary = await generateLLMCommentary(kifu, llmClient, config.model, {
        verbose: options.verbose,
        intervalMoves: options.intervalMoves,
      })
    }
    else {
      console.info('テンプレートベースで実況コメントを生成します...')
      console.info('')
      commentary = generateCommentary(kifu)
    }

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
