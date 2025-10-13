import type { BotConfig } from './types'

import process, { env } from 'node:process'

import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

import { MessageHandler } from './handlers/message-handler'
import { YouTubeClient } from './youtube/client'
import { LiveChatPoller } from './youtube/live-chat-poller'

import 'dotenv/config'

setGlobalFormat(Format.Pretty)
setGlobalLogLevel(env.LOG_LEVEL === 'debug' ? LogLevel.Debug : LogLevel.Log)

const log = useLogg('YouTubeBot').useGlobalConfig()

async function main() {
  // Load configuration from environment
  const config: BotConfig = {
    youtube: {
      apiKey: env.YOUTUBE_API_KEY || '',
      videoId: env.YOUTUBE_VIDEO_ID || '',
    },
    pollingIntervalMs: Number.parseInt(env.POLLING_INTERVAL_MS || '5000', 10),
    maxMessagesPerPoll: Number.parseInt(env.MAX_MESSAGES_PER_POLL || '50', 10),
  }

  // Validate configuration
  if (!config.youtube.apiKey) {
    log.error('YOUTUBE_API_KEYが設定されていません。.envファイルに設定してください。')
    process.exit(1)
  }

  if (!config.youtube.videoId) {
    log.error('YOUTUBE_VIDEO_IDが設定されていません。.envファイルに設定してください。')
    process.exit(1)
  }

  if (!env.LLM_API_KEY) {
    log.warn('LLM_API_KEYが設定されていません。応答生成は無効になります。')
  }

  if (!env.TTS_API_KEY) {
    log.warn('TTS_API_KEYが設定されていません。音声生成は無効になります。')
  }

  // Initialize YouTube client with API Key
  const youtubeClient = new YouTubeClient(config.youtube.apiKey)

  // Get video info (optional - skip if quota exceeded)
  try {
    log
      .withField('videoId', config.youtube.videoId)
      .log('動画情報を取得中...')

    const videoInfo = await youtubeClient.getVideoInfo(config.youtube.videoId)
    if (videoInfo) {
      log
        .withField('title', videoInfo.title)
        .withField('status', videoInfo.status)
        .log('動画が見つかりました')
    }
  }
  catch (error) {
    log
      .withError(error)
      .warn('動画情報の取得に失敗しました（クォータ超過の可能性）。ライブチャット接続を試みます。')
  }

  // Get live chat ID
  const liveChatId = await youtubeClient.getLiveChatId(config.youtube.videoId)
  if (!liveChatId) {
    log.error('アクティブなライブチャットが見つかりません。動画がライブストリームであり、開始されているか確認してください。')
    process.exit(1)
  }

  log
    .withField('liveChatId', liveChatId)
    .log('ライブチャットに接続しました')

  // Initialize message handler
  const messageHandler = new MessageHandler()

  // Initialize and start poller
  const poller = new LiveChatPoller(
    youtubeClient,
    {
      liveChatId,
      pollingIntervalMs: config.pollingIntervalMs,
      maxMessagesPerPoll: config.maxMessagesPerPoll,
      onMessage: async (message) => {
        // Handle message with LLM and TTS
        await messageHandler.handleMessage(message)
      },
      onError: (error) => {
        log.withError(error).error('ライブチャットポーラーエラー')
      },
    },
    log,
  )

  poller.start()

  log.log('YouTube Botが起動しました。停止するにはCtrl+Cを押してください。')

  // Graceful shutdown
  async function gracefulShutdown(signal: string) {
    log.log(`${signal}を受信しました。シャットダウン中...`)
    poller.stop()
    process.exit(0)
  }

  process.on('SIGINT', async () => {
    await gracefulShutdown('SIGINT')
  })

  process.on('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM')
  })
}

main().catch((err) => {
  log.withError(err).error('致命的なエラーが発生しました')
  process.exit(1)
})
