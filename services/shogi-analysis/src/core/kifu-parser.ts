import type { KifuFormat, ParsedKifu } from '../types'

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { Parsers } from 'json-kifu-format'

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
    return jkfMoves.slice(1).map((jkfMove, index) => ({
      moveNumber: index + 1,
      player: (index % 2 === 0) ? '先手' : '後手',
      move: this.formatMove(jkfMove),
      timeSpent: jkfMove.time?.now,
      comment: jkfMove.comments?.join(' '),
    }))
  }

  /**
   * Format a move from JKF to Japanese notation
   * @param jkfMove - Move object from JKF
   * @returns Japanese move notation (e.g., "７六歩")
   */
  private formatMove(jkfMove: any): string {
    // Handle special moves
    if (!jkfMove.move) {
      return jkfMove.special || '投了'
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

    // Number to kanji mapping
    const kanjiNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

    // Format position
    const x = kanjiNumbers[to.x]
    const y = to.y

    // Get piece name
    const pieceName = pieceNames[piece] || piece

    // Check if move is "same position" (同)
    if (same) {
      return `同${pieceName}`
    }

    // Promotion mark
    const promotion = jkfMove.move.promote ? '成' : ''

    return `${x}${y}${pieceName}${promotion}`
  }
}
