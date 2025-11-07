#!/usr/bin/env node

import process from 'node:process'

import { generateCommentary } from './commentary'
import { loadLLMConfig } from './config'
import { KifuParser } from './core/kifu-parser'
import { LLMClient } from './llm-client'
import { generateLLMCommentary } from './llm-commentary'

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]) {
  const options = {
    kifuPath: '',
    useLLM: false,
    intervalMoves: 10,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--llm') {
      options.useLLM = true
    }
    else if (arg === '--interval' && i + 1 < args.length) {
      options.intervalMoves = Number.parseInt(args[++i], 10)
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
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2)

  // Check arguments
  if (args.length === 0) {
    console.info('使用法: tsx src/index.ts [オプション] <棋譜ファイル>')
    console.info('')
    console.info('オプション:')
    console.info('  --llm              LLMを使って実況コメントを生成（デフォルト: テンプレートベース）')
    console.info('  --interval <N>     N手ごとにコメント生成（デフォルト: 10）')
    console.info('  --verbose, -v      詳細なログを表示')
    console.info('')
    console.info('例:')
    console.info('  tsx src/index.ts data/sample-kifu/example1.kif')
    console.info('  tsx src/index.ts --llm data/sample-kifu/example1.kif')
    console.info('  tsx src/index.ts --llm --interval 5 --verbose data/sample-kifu/example1.kif')
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
    // Parse kifu file
    console.info(`棋譜ファイルを読み込んでいます: ${options.kifuPath}`)
    console.info('')

    const parser = new KifuParser()
    const kifu = await parser.parseFile(options.kifuPath)

    console.info('棋譜の解析が完了しました。')
    console.info(`手数: ${kifu.moves.length}`)
    if (kifu.header.black)
      console.info(`先手: ${kifu.header.black}`)
    if (kifu.header.white)
      console.info(`後手: ${kifu.header.white}`)
    console.info('')

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
