import process, { env } from 'node:process'

import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { Client as AiriClient } from '@proj-airi/server-sdk'
import { KifuParser } from '@proj-airi/shogi-analysis/parser'

import { loadConfig } from './config'

import 'dotenv/config'

setGlobalFormat(Format.Pretty)
setGlobalLogLevel(env.LOG_LEVEL === 'debug' ? LogLevel.Debug : LogLevel.Log)

const log = useLogg('ShogiCommentaryBot').useGlobalConfig()

/** Special (non-positional) moves that terminate the game */
const SPECIAL_MOVES = ['投了', '中断', '千日手', '時間切れ', '反則負け']

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Determine the game phase from the move number.
 * Mirrors the heuristic used in shogi-analysis commentary generation.
 */
function getPhase(moveNumber: number): '序盤' | '中盤' | '終盤' {
  if (moveNumber <= 30)
    return '序盤'
  if (moveNumber <= 80)
    return '中盤'
  return '終盤'
}

/**
 * Wait until the module is announced to the AIRI Server. The SDK silently
 * drops sends that happen before the connection is established, so we must
 * confirm registration before streaming moves.
 * @returns true if announced within the timeout, false otherwise
 */
async function waitForAnnounced(airiClient: AiriClient, timeoutMs = 5000): Promise<boolean> {
  let announced = false
  airiClient.onEvent('module:announced', () => {
    announced = true
  })

  const deadline = Date.now() + timeoutMs
  // eslint-disable-next-line no-unmodified-loop-condition -- `announced` is set asynchronously in the onEvent callback above
  while (!announced && Date.now() < deadline)
    await sleep(100)

  return announced
}

async function main() {
  const config = loadConfig()

  log
    .withField('kifuFile', config.kifuFile)
    .withField('ownSide', config.ownSide)
    .log('棋譜を読み込んでいます...')

  const parser = new KifuParser()
  const kifu = await parser.parseFile(config.kifuFile)

  log
    .withField('title', kifu.header.title)
    .withField('black', kifu.header.black)
    .withField('white', kifu.header.white)
    .withField('moves', kifu.moves.length)
    .log('棋譜を読み込みました')

  const airiClient = new AiriClient({
    name: 'shogi-commentary-bot',
    possibleEvents: ['input:text'],
    url: config.airiServerUrl,
    token: config.airiServerToken,
  })

  let stopped = false
  function gracefulShutdown(signal: string) {
    log.log(`${signal}を受信しました。シャットダウン中...`)
    stopped = true
    airiClient.close()
    process.exit(0)
  }
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

  const announced = await waitForAnnounced(airiClient)
  if (announced)
    log.log('AIRI Serverに接続・登録しました')
  else
    log.warn('module:announcedを確認できませんでした。接続が未完了かもしれませんが、送信を継続します。')

  // Announce the start of the game so the character can set the scene.
  airiClient.send({
    type: 'input:text',
    data: {
      text: `対局開始: ${kifu.header.black ?? '先手'} 対 ${kifu.header.white ?? '後手'}`,
      source: 'shogi',
      shogi: {
        kind: 'gameStart',
        gameInfo: {
          title: kifu.header.title,
          black: kifu.header.black,
          white: kifu.header.white,
          date: kifu.header.date,
          ownSide: config.ownSide,
        },
      },
    },
  })
  log.log('対局開始を送信しました')

  await sleep(config.moveIntervalMs)

  const limit = config.maxMoves > 0
    ? Math.min(config.maxMoves, kifu.moves.length)
    : kifu.moves.length

  for (let i = 0; i < limit; i++) {
    if (stopped)
      break

    const move = kifu.moves[i]

    // Terminal moves (resignation etc.) end the game.
    if (SPECIAL_MOVES.includes(move.move)) {
      airiClient.send({
        type: 'input:text',
        data: {
          text: `${move.move} (${kifu.header.result ?? ''})`,
          source: 'shogi',
          shogi: {
            kind: 'gameEnd',
            result: kifu.header.result || move.move,
          },
        },
      })
      log.withField('move', move.move).log('対局終了を送信しました')
      break
    }

    const isOwnMove = move.player === config.ownSide

    airiClient.send({
      type: 'input:text',
      data: {
        text: `${move.moveNumber} ${move.player} ${move.move}`,
        source: 'shogi',
        shogi: {
          kind: 'move',
          moveNumber: move.moveNumber,
          player: move.player,
          move: move.move,
          isOwnMove,
          phase: getPhase(move.moveNumber),
          comment: move.comment,
        },
      },
    })

    log
      .withField('n', move.moveNumber)
      .withField('player', move.player)
      .withField('move', move.move)
      .withField('own', isOwnMove)
      .log('指し手を送信しました')

    await sleep(config.moveIntervalMs)
  }

  log.log('すべての手を送信しました。終了します。')
  airiClient.close()
  process.exit(0)
}

main().catch((err) => {
  log.withError(err).error('致命的なエラーが発生しました')
  process.exit(1)
})
