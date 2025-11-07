import type { ParsedKifu } from '../src/types'

import { describe, expect, it } from 'vitest'

import { generateCommentary } from '../src/commentary'

describe('generateCommentary', () => {
  it('should generate opening commentary with full header', () => {
    const kifu: ParsedKifu = {
      header: {
        tournament: 'NHK杯',
        black: '羽生善治',
        white: '加藤一二三',
        date: '1989/01/09',
      },
      moves: [],
    }

    const commentary = generateCommentary(kifu)

    expect(commentary[0]).toBe('NHK杯、羽生善治先手、加藤一二三後手の対局（1989/01/09）が始まりました。')
  })

  it('should generate opening commentary without date', () => {
    const kifu: ParsedKifu = {
      header: {
        tournament: 'テスト対局',
        black: 'テスト太郎',
        white: 'テスト花子',
      },
      moves: [],
    }

    const commentary = generateCommentary(kifu)

    expect(commentary[0]).toBe('テスト対局、テスト太郎先手、テスト花子後手の対局が始まりました。')
  })

  it('should generate default opening when header is minimal', () => {
    const kifu: ParsedKifu = {
      header: {},
      moves: [],
    }

    const commentary = generateCommentary(kifu)

    expect(commentary[0]).toBe('対局が始まりました。')
  })

  it('should generate first move commentary', () => {
    const kifu: ParsedKifu = {
      header: {},
      moves: [
        {
          moveNumber: 1,
          player: '先手',
          move: '七6歩',
        },
      ],
    }

    const commentary = generateCommentary(kifu)

    expect(commentary).toContain('初手は七6歩です。')
  })

  it('should generate commentary for 10th move in opening', () => {
    const moves = []
    for (let i = 1; i <= 10; i++) {
      moves.push({
        moveNumber: i,
        player: i % 2 === 1 ? '先手' : '後手',
        move: `${i}手目`,
      })
    }

    const kifu: ParsedKifu = {
      header: {},
      moves,
    }

    const commentary = generateCommentary(kifu)

    // 10手目のコメントが含まれているか
    const move10Commentary = commentary.find(c => c.includes('10手目'))
    expect(move10Commentary).toBeDefined()
    expect(move10Commentary).toContain('序盤の駆け引きが続きます')
  })

  it('should generate commentary for 45th move in middlegame', () => {
    const moves = []
    for (let i = 1; i <= 45; i++) {
      moves.push({
        moveNumber: i,
        player: i % 2 === 1 ? '先手' : '後手',
        move: `${i}手目`,
      })
    }

    const kifu: ParsedKifu = {
      header: {},
      moves,
    }

    const commentary = generateCommentary(kifu)

    // 45手目のコメントが含まれているか (15の倍数)
    const move45Commentary = commentary.find(c => c.includes('45手目'))
    expect(move45Commentary).toBeDefined()
    expect(move45Commentary).toContain('中盤戦に入っています')
  })

  it('should generate commentary for 90th move in endgame', () => {
    const moves = []
    for (let i = 1; i <= 90; i++) {
      moves.push({
        moveNumber: i,
        player: i % 2 === 1 ? '先手' : '後手',
        move: `${i}手目`,
      })
    }

    const kifu: ParsedKifu = {
      header: {},
      moves,
    }

    const commentary = generateCommentary(kifu)

    // 90手目のコメントが含まれているか
    const move90Commentary = commentary.find(c => c.includes('90手目'))
    expect(move90Commentary).toBeDefined()
    expect(move90Commentary).toContain('終盤戦です')
  })

  it('should generate closing commentary', () => {
    const kifu: ParsedKifu = {
      header: {},
      moves: [
        { moveNumber: 1, player: '先手', move: '七6歩' },
        { moveNumber: 2, player: '後手', move: '三4歩' },
        { moveNumber: 3, player: '先手', move: '投了' },
      ],
    }

    const commentary = generateCommentary(kifu)

    const lastLine = commentary[commentary.length - 1]
    expect(lastLine).toBe('まで3手で対局終了です。お疲れ様でした。')
  })

  it('should include empty lines for formatting', () => {
    const kifu: ParsedKifu = {
      header: {},
      moves: [
        { moveNumber: 1, player: '先手', move: '七6歩' },
      ],
    }

    const commentary = generateCommentary(kifu)

    // 空行が含まれているか
    expect(commentary).toContain('')
  })

  it('should handle real game data structure', () => {
    // Simulate a short game
    const kifu: ParsedKifu = {
      header: {
        tournament: 'NHK杯',
        black: '羽生善治',
        white: '加藤一二三',
        date: '1989/01/09 9:00:00',
      },
      moves: Array.from({ length: 68 }, (_, i) => ({
        moveNumber: i + 1,
        player: (i % 2 === 0) ? '先手' : '後手',
        move: i === 67 ? '投了' : `${i + 1}手目の手`,
      })),
    }

    const commentary = generateCommentary(kifu)

    // Opening should be present
    expect(commentary[0]).toContain('NHK杯')
    expect(commentary[0]).toContain('羽生善治')
    expect(commentary[0]).toContain('加藤一二三')

    // First move should be present
    expect(commentary.some(c => c.includes('初手'))).toBe(true)

    // Closing should mention 68 moves
    const lastLine = commentary[commentary.length - 1]
    expect(lastLine).toBe('まで68手で対局終了です。お疲れ様でした。')
  })
})
