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
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: env.GOOGLE_REFRESH_TOKEN || '',
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
    outputDir: env.AUDIO_OUTPUT_DIR || './audio-output',
    pollingIntervalMs: Number.parseInt(env.POLLING_INTERVAL_MS || '5000', 10),
    maxMessagesPerPoll: Number.parseInt(env.MAX_MESSAGES_PER_POLL || '50', 10),
  }

  // Validate configuration
  if (!config.youtube.clientId || !config.youtube.clientSecret || !config.youtube.refreshToken) {
    log.error('Missing YouTube API credentials. Please run "pnpm auth" first.')
    process.exit(1)
  }

  if (!config.llm.apiKey) {
    log.error('Missing LLM API key. Please set LLM_API_KEY in .env file.')
    process.exit(1)
  }

  // Initialize YouTube client
  const youtubeClient = new YouTubeClient(config.youtube)

  // Find active live broadcasts
  log.log('Searching for active live broadcasts...')
  const broadcasts = await youtubeClient.getActiveLiveBroadcasts()

  if (broadcasts.length === 0) {
    log.warn('No active live broadcasts found')

    // Check for upcoming broadcasts
    const upcomingBroadcasts = await youtubeClient.getUpcomingLiveBroadcasts()
    if (upcomingBroadcasts.length > 0) {
      log.log('Found upcoming broadcasts:')
      upcomingBroadcasts.forEach((b) => {
        log.log(`  - ${b.title} (${b.status})`)
      })
      log.log('Please start a live stream and run this bot again.')
    }

    process.exit(1)
  }

  // Use the first active broadcast
  const broadcast = broadcasts[0]
  log
    .withField('title', broadcast.title)
    .withField('liveChatId', broadcast.liveChatId)
    .log('Connected to live broadcast')

  // Import chat provider based on config
  const { openai } = await import('@xsai-ext/providers-cloud')
  const chatProvider = openai()

  // Initialize message handler
  const messageHandler = new MessageHandler(config, chatProvider, log)

  // Initialize and start poller
  const poller = new LiveChatPoller(
    youtubeClient,
    {
      liveChatId: broadcast.liveChatId,
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
