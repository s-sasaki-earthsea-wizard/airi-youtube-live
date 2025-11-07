import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { KifuParser } from '../../src/core/kifu-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('kifuParser', () => {
  const parser = new KifuParser()

  describe('parseFile', () => {
    it('should parse KIF format correctly', async () => {
      const kifuPath = join(__dirname, '../fixtures/simple-game.kif')
      const kifu = await parser.parseFile(kifuPath)

      // Header validation
      expect(kifu.header).toBeDefined()
      expect(kifu.header.tournament).toBe('テスト対局')
      expect(kifu.header.black).toBe('テスト太郎')
      expect(kifu.header.white).toBe('テスト花子')
      expect(kifu.header.date).toBe('2024/11/07')
    })

    it('should extract moves correctly', async () => {
      const kifuPath = join(__dirname, '../fixtures/simple-game.kif')
      const kifu = await parser.parseFile(kifuPath)

      // Moves validation
      expect(kifu.moves).toHaveLength(6)
      expect(kifu.moves[0].moveNumber).toBe(1)
      expect(kifu.moves[0].player).toBe('先手')
      expect(kifu.moves[0].move).toMatch(/歩/)
    })

    it('should handle special moves like resignation', async () => {
      const kifuPath = join(__dirname, '../fixtures/simple-game.kif')
      const kifu = await parser.parseFile(kifuPath)

      const lastMove = kifu.moves[kifu.moves.length - 1]
      expect(lastMove.move).toBe('投了')
    })

    it('should parse real game (Habu vs Kato)', async () => {
      const kifuPath = join(__dirname, '../../data/sample-kifu/kifu-example.kif')
      const kifu = await parser.parseFile(kifuPath)

      // Header validation for historical game
      expect(kifu.header.tournament).toBe('NHK杯')
      expect(kifu.header.black).toBe('羽生善治')
      expect(kifu.header.white).toBe('加藤一二三')
      expect(kifu.header.date).toBe('1989/01/09 9:00:00')

      // Moves validation
      expect(kifu.moves).toHaveLength(68)
      expect(kifu.moves[0].moveNumber).toBe(1)
      expect(kifu.moves[0].player).toBe('先手')
      expect(kifu.moves[67].moveNumber).toBe(68)
      expect(kifu.moves[67].move).toBe('投了')
    })

    it('should throw error for unsupported format', async () => {
      // Create a temporary file with unsupported extension
      const { writeFile, unlink } = await import('node:fs/promises')
      const tmpFile = join(__dirname, '../fixtures/test.txt')

      try {
        await writeFile(tmpFile, 'test content')
        await expect(
          parser.parseFile(tmpFile),
        ).rejects.toThrow('Unknown file extension: .txt')
      }
      finally {
        await unlink(tmpFile).catch(() => {}) // Clean up
      }
    })

    it('should throw error for non-existent file', async () => {
      await expect(
        parser.parseFile('nonexistent.kif'),
      ).rejects.toThrow()
    })
  })

  describe('move notation formatting', () => {
    it('should format moves with kanji numbers', async () => {
      const kifuPath = join(__dirname, '../fixtures/simple-game.kif')
      const kifu = await parser.parseFile(kifuPath)

      // First move should be "七6歩" or similar
      expect(kifu.moves[0].move).toMatch(/[一二三四五六七八九][1-9]歩/)
    })

    it('should handle same position moves (同)', async () => {
      const kifuPath = join(__dirname, '../../data/sample-kifu/kifu-example.kif')
      const kifu = await parser.parseFile(kifuPath)

      // Find moves with "同"
      const sameMoves = kifu.moves.filter(m => m.move.startsWith('同'))
      expect(sameMoves.length).toBeGreaterThan(0)

      // Example: "同銀", "同香" etc
      sameMoves.forEach((move) => {
        expect(move.move).toMatch(/^同[歩香桂銀金角飛玉と龍馬]/)
      })
    })

    it('should handle promoted pieces', async () => {
      const kifuPath = join(__dirname, '../../data/sample-kifu/kifu-example.kif')
      const kifu = await parser.parseFile(kifuPath)

      // Find promoted moves (成)
      const promotedMoves = kifu.moves.filter(m => m.move.includes('成'))
      expect(promotedMoves.length).toBeGreaterThan(0)
    })
  })

  describe('player turn calculation', () => {
    it('should alternate players correctly', async () => {
      const kifuPath = join(__dirname, '../fixtures/simple-game.kif')
      const kifu = await parser.parseFile(kifuPath)

      expect(kifu.moves[0].player).toBe('先手')
      expect(kifu.moves[1].player).toBe('後手')
      expect(kifu.moves[2].player).toBe('先手')
      expect(kifu.moves[3].player).toBe('後手')
    })
  })
})
