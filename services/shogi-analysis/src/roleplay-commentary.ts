import type { ChatMessage, LLMClient } from './llm-client'
import type { ParsedKifu, RoleplayMove } from './types'

import process from 'node:process'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * Default number of moves to narrate. The full game can be hundreds of moves,
 * so the prototype caps narration to keep API usage in check while still
 * reaching the early middlegame. Override with the maxMoves option.
 */
const DEFAULT_MAX_MOVES = 40

/**
 * Path to the production roleplay system prompt shared with stage-web.
 * Using the same file keeps the prototype and the live character in sync.
 * Override with the SHOGI_SYSTEM_PROMPT_PATH environment variable.
 */
const DEFAULT_SYSTEM_PROMPT_PATH = join(
  __dirname,
  '../../../apps/stage-web/public/prompts/shogi-system-prompt.md',
)

/** Which side of the board the streamer character impersonates */
export type OwnSide = '先手' | '後手'

export interface RoleplayOptions {
  /** Explicitly pick the side the character plays (overrides auto-detection) */
  side?: OwnSide
  /** Number of moves to narrate (default: 40) */
  maxMoves?: number
  /** Path to the system prompt markdown (default: stage-web shogi prompt) */
  systemPromptPath?: string
  /** Print progress to stderr while generating */
  verbose?: boolean
}

export interface RoleplayCommentaryResult {
  /** The side the character impersonated */
  ownSide: OwnSide
  /** Human-readable explanation of how the side was chosen */
  ownSideReason: string
  /** Opening greeting spoken before the first move */
  greeting: string
  /** Narrated moves, each carrying its structured data and generated line */
  moves: RoleplayMove[]
}

/**
 * Decide which side the character impersonates.
 * Hybrid strategy: explicit option > player name containing "さめ" > default 先手.
 */
function resolveOwnSide(
  kifu: ParsedKifu,
  explicit?: OwnSide,
): { side: OwnSide, reason: string } {
  if (explicit)
    return { side: explicit, reason: `explicitly specified (${explicit})` }

  const { black, white } = kifu.header
  if (black?.includes('さめ'))
    return { side: '先手', reason: `先手 player name matches "さめ" (${black})` }
  if (white?.includes('さめ'))
    return { side: '後手', reason: `後手 player name matches "さめ" (${white})` }

  return { side: '先手', reason: 'defaulted to 先手' }
}

/**
 * Load the roleplay system prompt from disk.
 */
function loadSystemPrompt(systemPromptPath?: string): string {
  const path = systemPromptPath || process.env.SHOGI_SYSTEM_PROMPT_PATH || DEFAULT_SYSTEM_PROMPT_PATH
  try {
    return readFileSync(path, 'utf-8').trim()
  }
  catch (error) {
    throw new Error(
      `Failed to load shogi system prompt: ${path}\n`
      + `Set SHOGI_SYSTEM_PROMPT_PATH or pass systemPromptPath. `
      + `Cause: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Build the structured "game start" notice handed to the character.
 * This mirrors the data the future bot will send to stage-web.
 */
function buildStartNotice(kifu: ParsedKifu, ownSide: OwnSide): string {
  const { tournament, title, black, white, date } = kifu.header
  const lines = ['【対局開始】']

  if (tournament || title)
    lines.push(`棋戦：${tournament || title}`)
  if (black)
    lines.push(`先手：${black}`)
  if (white)
    lines.push(`後手：${white}`)
  if (date)
    lines.push(`対局日：${date}`)

  lines.push(`あなたが指すのは：${ownSide}`)
  lines.push('これから対局が始まります。意気込みを一言どうぞ。')

  return lines.join('\n')
}

/**
 * Build the structured notice for a single move, matching the fields the
 * system prompt promises ("手数 / 手番 / 指し手 / 自分の手か相手の手か / フェーズ").
 */
function buildMoveNotice(move: RoleplayMove): string {
  return [
    `手数：${move.moveNumber}手目`,
    `手番：${move.player}`,
    `指し手：${move.move}（読み：${move.reading}）`,
    `これは：${move.isOwnMove ? 'あなた自身の手' : '相手の手'}`,
    `フェーズ：${move.phase}`,
  ].join('\n')
}

/**
 * Generate roleplay commentary where the character impersonates one side and
 * reacts to each move in turn, keeping a running conversation for continuity.
 */
export async function generateRoleplayCommentary(
  kifu: ParsedKifu,
  llmClient: LLMClient,
  model: string,
  options: RoleplayOptions = {},
): Promise<RoleplayCommentaryResult> {
  const { side, maxMoves = DEFAULT_MAX_MOVES, systemPromptPath, verbose = false } = options

  const systemPrompt = loadSystemPrompt(systemPromptPath)
  const { side: ownSide, reason: ownSideReason } = resolveOwnSide(kifu, side)

  // Running conversation: system prompt persists, each move appends a turn.
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]

  try {
    // Opening greeting
    if (verbose)
      console.error('対局開始の挨拶を生成中...')

    messages.push({ role: 'user', content: buildStartNotice(kifu, ownSide) })
    const greeting = await llmClient.generateChat(messages, model)
    messages.push({ role: 'assistant', content: greeting })

    // Move-by-move narration
    const movesToNarrate = kifu.moves.slice(0, maxMoves)
    const narratedMoves: RoleplayMove[] = []

    for (const move of movesToNarrate) {
      const roleplayMove: RoleplayMove = {
        ...move,
        isOwnMove: move.player === ownSide,
      }

      if (verbose)
        console.error(`${move.moveNumber}手目（${move.move}）のセリフを生成中...`)

      messages.push({ role: 'user', content: buildMoveNotice(roleplayMove) })
      const line = await llmClient.generateChat(messages, model)
      messages.push({ role: 'assistant', content: line })

      roleplayMove.commentary = line
      narratedMoves.push(roleplayMove)
    }

    return {
      ownSide,
      ownSideReason,
      greeting,
      moves: narratedMoves,
    }
  }
  catch (error) {
    throw new Error(
      `Roleplay commentary generation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
