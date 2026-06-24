import type { KifuFormat, ParsedKifu } from '../types'

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import jkf from 'json-kifu-format'

import { getGamePhase } from '../phase'

const { Parsers } = jkf

/**
 * Kifu (game record) parser
 * Supports KIF, KI2, and CSA formats
 */
export class KifuParser {
  /**
   * Parse a kifu file and convert to internal format
   * @param filePath - Path to the kifu file
   * @returns Parsed kifu data
   */
  async parseFile(filePath: string): Promise<ParsedKifu> {
    const content = await readFile(filePath, 'utf-8')
    const format = this.detectFormat(filePath)

    let jkf: any
    switch (format) {
      case 'kif':
        jkf = Parsers.parseKIF(content)
        break
      case 'ki2':
        jkf = Parsers.parseKI2(content)
        break
      case 'csa':
        jkf = Parsers.parseCSA(content)
        break
      default:
        throw new Error(`Unsupported file format: ${format}`)
    }

    return this.convertToInternalFormat(jkf)
  }

  /**
   * Detect kifu format from file extension
   * @param filePath - Path to the kifu file
   * @returns Detected format
   */
  private detectFormat(filePath: string): KifuFormat {
    const ext = extname(filePath).toLowerCase()
    switch (ext) {
      case '.kif':
        return 'kif'
      case '.ki2':
        return 'ki2'
      case '.csa':
        return 'csa'
      default:
        throw new Error(`Unknown file extension: ${ext}. Supported: .kif, .ki2, .csa`)
    }
  }

  /**
   * Convert JKF (JSON Kifu Format) to internal ParsedKifu format
   * @param jkf - JSON Kifu Format object
   * @returns Internal kifu format
   */
  private convertToInternalFormat(jkf: any): ParsedKifu {
    return {
      header: {
        title: jkf.header?.['棋戦'] || jkf.header?.['表題'],
        black: jkf.header?.['先手'] || jkf.header?.['下手'],
        white: jkf.header?.['後手'] || jkf.header?.['上手'],
        date: jkf.header?.['開始日時'],
        tournament: jkf.header?.['棋戦'],
        result: jkf.header?.['結果'],
      },
      moves: this.extractMoves(jkf.moves),
    }
  }

  /**
   * Extract moves from JKF format
   * @param jkfMoves - Moves array from JKF
   * @returns Array of Move objects
   */
  private extractMoves(jkfMoves: any[]): ParsedKifu['moves'] {
    // Skip the first element (initial position)
    return jkfMoves.slice(1).map((jkfMove, index) => {
      const moveNumber = index + 1
      return {
        moveNumber,
        player: (index % 2 === 0) ? '先手' as const : '後手' as const,
        move: this.formatMove(jkfMove),
        reading: this.formatMoveReading(jkfMove),
        phase: getGamePhase(moveNumber),
        timeSpent: jkfMove.time?.now,
        comment: jkfMove.comments?.join(' '),
      }
    })
  }

  /**
   * Format a move from JKF to Japanese notation
   * @param jkfMove - Move object from JKF
   * @returns Japanese move notation (e.g., "７六歩")
   */
  private formatMove(jkfMove: any): string {
    // Handle special moves
    if (!jkfMove.move) {
      // Map CSA special move codes to Japanese
      const specialMoves: Record<string, string> = {
        TORYO: '投了',
        CHUDAN: '中断',
        SENNICHITE: '千日手',
        TIME_UP: '時間切れ',
        ILLEGAL_MOVE: '反則負け',
      }
      return specialMoves[jkfMove.special] || jkfMove.special || '投了'
    }

    const { to, piece, same } = jkfMove.move

    // Piece name mapping
    const pieceNames: Record<string, string> = {
      FU: '歩',
      KY: '香',
      KE: '桂',
      GI: '銀',
      KI: '金',
      KA: '角',
      HI: '飛',
      OU: '玉',
      TO: 'と',
      NY: '成香',
      NK: '成桂',
      NG: '成銀',
      UM: '馬',
      RY: '龍',
    }

    // File (筋) uses full-width arabic numerals, rank (段) uses kanji.
    const fileNumbers = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９']
    const rankNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

    // Get piece name
    const pieceName = pieceNames[piece] || piece

    // Promotion mark
    const promotion = jkfMove.move.promote ? '成' : ''

    // A move without a `from` square is a drop from hand (打).
    const drop = jkfMove.move.from ? '' : '打'

    // "Same square" recapture is written as 同, omitting the coordinates.
    if (same) {
      return `同${pieceName}${promotion}`
    }

    // Format position: file (x, full-width arabic) then rank (y, kanji)
    const file = fileNumbers[to.x]
    const rank = rankNumbers[to.y]

    return `${file}${rank}${pieceName}${promotion}${drop}`
  }

  /**
   * Generate the hiragana reading of a move for TTS.
   * Pairs with formatMove so the commentary bot can hand the character LLM an
   * explicit reading, avoiding mis-readings like "８四歩" → "はちはちふ".
   * @param jkfMove - Move object from JKF
   * @returns Hiragana reading (e.g., "ななろくふ", "ごろくふうち")
   */
  private formatMoveReading(jkfMove: any): string {
    // Handle special moves
    if (!jkfMove.move) {
      const specialReadings: Record<string, string> = {
        TORYO: 'とうりょう',
        CHUDAN: 'ちゅうだん',
        SENNICHITE: 'せんにちて',
        TIME_UP: 'じかんぎれ',
        ILLEGAL_MOVE: 'はんそくまけ',
      }
      return specialReadings[jkfMove.special] || 'とうりょう'
    }

    const { to, piece, from, same, promote } = jkfMove.move

    // Read digits one at a time (7→なな, 4→よん, 9→きゅう), per the TTS guidance.
    const numberReadings = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']

    // Piece readings (TTS-friendly, per shogi-system-prompt.md guidance)
    const pieceReadings: Record<string, string> = {
      FU: 'ふ',
      KY: 'きょう',
      KE: 'けい',
      GI: 'ぎん',
      KI: 'きん',
      KA: 'かく',
      HI: 'ひ',
      OU: 'ぎょく',
      TO: 'と',
      NY: 'なりきょう',
      NK: 'なりけい',
      NG: 'なりぎん',
      UM: 'うま',
      RY: 'りゅう',
    }

    const pieceReading = pieceReadings[piece] || piece
    const promotionReading = promote ? 'なり' : ''
    const dropReading = from ? '' : 'うち'

    // "Same square" recapture is read as どう
    if (same) {
      return `どう${pieceReading}${promotionReading}`
    }

    const fileReading = numberReadings[to.x]
    const rankReading = numberReadings[to.y]

    return `${fileReading}${rankReading}${pieceReading}${promotionReading}${dropReading}`
  }
}
