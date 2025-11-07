import type { LLMClient } from './llm-client'
import type { ParsedKifu } from './types'

import { fillPromptTemplate, getCachedPrompt } from './prompt-loader'

/**
 * Generate prompt for opening commentary
 */
function generateOpeningPrompt(kifu: ParsedKifu): string {
  const { black, white, tournament, date } = kifu.header
  const parts = []

  if (tournament)
    parts.push(`棋戦：${tournament}`)
  if (black && white)
    parts.push(`対局者：先手 ${black}、後手 ${white}`)
  if (date)
    parts.push(`対局日：${date}`)

  const gameInfo = parts.length > 0 ? parts.join('\n') : '対局情報なし'

  const systemPrompt = getCachedPrompt('system')
  const openingTemplate = getCachedPrompt('opening')

  const openingPrompt = fillPromptTemplate(openingTemplate, {
    GAME_INFO: gameInfo,
  })

  return `${systemPrompt}\n\n${openingPrompt}`
}

/**
 * Generate prompt for move commentary
 */
function generateMovePrompt(
  moveNumber: number,
  player: string,
  move: string,
  comment?: string,
): string {
  const phase = moveNumber <= 30 ? '序盤' : moveNumber <= 80 ? '中盤' : '終盤'

  // Add phase-specific hints
  let phaseHint = ''
  if (phase === '序盤') {
    phaseHint = '序盤では、駒組みや戦型の選択に注目してください。'
  }
  else if (phase === '中盤') {
    phaseHint = '中盤では、攻めの狙いや受けの工夫に注目してください。'
  }
  else {
    phaseHint = '終盤では、寄せや詰みの有無に注目してください。'
  }

  const systemPrompt = getCachedPrompt('system')
  const moveTemplate = getCachedPrompt('move')

  const movePrompt = fillPromptTemplate(moveTemplate, {
    MOVE_NUMBER: String(moveNumber),
    PHASE: phase,
    PLAYER: player,
    MOVE: move,
    COMMENT: comment ? `棋譜のコメント：${comment}` : '',
    PHASE_HINT: phaseHint,
  })

  return `${systemPrompt}\n\n${movePrompt}`
}

/**
 * Generate prompt for closing commentary
 */
function generateClosingPrompt(kifu: ParsedKifu): string {
  const totalMoves = kifu.moves.length
  const lastMove = kifu.moves[kifu.moves.length - 1]

  const systemPrompt = getCachedPrompt('system')
  const closingTemplate = getCachedPrompt('closing')

  const closingPrompt = fillPromptTemplate(closingTemplate, {
    TOTAL_MOVES: String(totalMoves),
    LAST_PLAYER: lastMove.player,
    LAST_MOVE: lastMove.move,
  })

  return `${systemPrompt}\n\n${closingPrompt}`
}

/**
 * Generate LLM-based commentary for a kifu
 */
export async function generateLLMCommentary(
  kifu: ParsedKifu,
  llmClient: LLMClient,
  model: string,
  options: {
    verbose?: boolean
    intervalMoves?: number
  } = {},
): Promise<string[]> {
  const { verbose = false, intervalMoves = 10 } = options
  const commentary: string[] = []

  try {
    // Opening commentary
    if (verbose)
      console.info('対局開始のコメントを生成中...')

    const openingPrompt = generateOpeningPrompt(kifu)
    const openingComment = await llmClient.generateText(openingPrompt, model)
    commentary.push(openingComment)
    commentary.push('') // Empty line

    // Move-by-move commentary
    for (let i = 0; i < kifu.moves.length; i++) {
      const move = kifu.moves[i]

      // First move, then every N moves
      const shouldComment = move.moveNumber === 1 || move.moveNumber % intervalMoves === 0

      if (shouldComment) {
        if (verbose) {
          console.info(`${move.moveNumber}手目のコメントを生成中...`)
        }

        const movePrompt = generateMovePrompt(
          move.moveNumber,
          move.player,
          move.move,
          move.comment,
        )
        const moveComment = await llmClient.generateText(movePrompt, model)
        commentary.push(`【${move.moveNumber}手目】${move.player}：${move.move}`)
        commentary.push(moveComment)
        commentary.push('') // Empty line
      }
    }

    // Closing commentary
    if (verbose)
      console.info('対局終了のコメントを生成中...')

    const closingPrompt = generateClosingPrompt(kifu)
    const closingComment = await llmClient.generateText(closingPrompt, model)
    commentary.push(closingComment)
  }
  catch (error) {
    throw new Error(`Commentary generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return commentary
}
