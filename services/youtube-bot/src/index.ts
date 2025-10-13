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
    llm: {
      provider: env.LLM_PROVIDER || 'openai',
      model: env.LLM_MODEL || 'gpt-4o-mini',
      apiKey: env.LLM_API_KEY || '',
    },
    tts: {
      provider: env.TTS_PROVIDER || 'openai-audio-speech',
      model: env.TTS_MODEL || 'tts-1',
      voice: env.TTS_VOICE || 'alloy',
      apiKey: env.TTS_API_KEY || env.LLM_API_KEY || '',
    },
    outputDir: env.AUDIO_OUTPUT_DIR || '/tmp/airi-youtube-bot/audio',
    pollingIntervalMs: Number.parseInt(env.POLLING_INTERVAL_MS || '5000', 10),
    maxMessagesPerPoll: Number.parseInt(env.MAX_MESSAGES_PER_POLL || '50', 10),
  }

  // Validate configuration
  if (!config.youtube.apiKey) {
    log.error('Missing YOUTUBE_API_KEY. Please set it in .env file.')
    process.exit(1)
  }

  if (!config.youtube.videoId) {
    log.error('Missing YOUTUBE_VIDEO_ID. Please set it in .env file.')
    process.exit(1)
  }

  if (!config.llm.apiKey) {
    log.error('Missing LLM API key. Please set LLM_API_KEY in .env file.')
    process.exit(1)
  }

  // Initialize YouTube client with API Key
  const youtubeClient = new YouTubeClient(config.youtube.apiKey)

  // Get video info
  log
    .withField('videoId', config.youtube.videoId)
    .log('Fetching video information...')

  const videoInfo = await youtubeClient.getVideoInfo(config.youtube.videoId)
  if (!videoInfo) {
    log.error('Failed to fetch video information. Check if YOUTUBE_VIDEO_ID is correct.')
    process.exit(1)
  }

  log
    .withField('title', videoInfo.title)
    .withField('status', videoInfo.status)
    .log('Video found')

  // Get live chat ID
  const liveChatId = await youtubeClient.getLiveChatId(config.youtube.videoId)
  if (!liveChatId) {
    log.error('No active live chat found. Make sure the video is a live stream and has started.')
    process.exit(1)
  }

  log
    .withField('liveChatId', liveChatId)
    .log('Connected to live chat')

  // Import chat provider based on config
  const { openai } = await import('@xsai-ext/providers-cloud')
  const chatProvider = openai()

  // Initialize message handler
  const messageHandler = new MessageHandler(config, chatProvider, log)

  // Initialize and start poller
  const poller = new LiveChatPoller(
    youtubeClient,
    {
      liveChatId,
      pollingIntervalMs: config.pollingIntervalMs,
      maxMessagesPerPoll: config.maxMessagesPerPoll,
      onMessage: async (message) => {
        await messageHandler.handleMessage(message)
      },
      onError: (error) => {
        log.withError(error).error('Live chat poller error')
      },
    },
    log,
  )

  poller.start()

  log.log('YouTube bot is now running. Press Ctrl+C to stop.')

  // Graceful shutdown
  async function gracefulShutdown(signal: string) {
    log.log(`Received ${signal}, shutting down...`)
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
  log.withError(err).error('Fatal error occurred')
  process.exit(1)
})
