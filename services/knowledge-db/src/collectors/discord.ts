/**
 * Discord Data Collector
 *
 * Collects messages from a specified Discord channel and stores them in the knowledge database.
 * Supports both historical message fetching (on startup) and real-time message monitoring.
 */

import type { Message, TextChannel } from 'discord.js'

import process, { env } from 'node:process'

import { embed } from '@xsai/embed'
import { Client, GatewayIntentBits } from 'discord.js'

import { db } from '../db/client.js'
import { postsTable } from '../db/schema.js'

import 'dotenv/config'

// Environment variables
const DISCORD_BOT_TOKEN = env.DISCORD_BOT_TOKEN
const DISCORD_CHANNEL_ID = env.DISCORD_CHANNEL_ID
// Default to unlimited (0 = fetch all), can be limited via env var
const HISTORICAL_MESSAGE_LIMIT = env.DISCORD_HISTORICAL_LIMIT
  ? Number.parseInt(env.DISCORD_HISTORICAL_LIMIT, 10)
  : 0 // 0 means fetch all available messages

// Validate required environment variables
if (!DISCORD_BOT_TOKEN) {
  console.error('[Discord Collector] DISCORD_BOT_TOKEN is required in .env')
  process.exit(1)
}

if (!DISCORD_CHANNEL_ID) {
  console.error('[Discord Collector] DISCORD_CHANNEL_ID is required in .env')
  process.exit(1)
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required to read message content
  ],
})

/**
 * Save a Discord message to the database with vector embedding
 */
async function saveMessage(message: Message): Promise<void> {
  try {
    // Skip empty messages
    if (!message.content || message.content.trim() === '') {
      console.info(`[Discord Collector] Skipping empty message ${message.id}`)
      return
    }

    // Generate embedding for the message content
    const embeddingResult = await embed({
      baseURL: env.EMBEDDING_API_BASE_URL!,
      apiKey: env.EMBEDDING_API_KEY!,
      model: env.EMBEDDING_MODEL!,
      input: message.content,
    })

    // Prepare values with embedding based on dimension
    const values: any = {
      source: 'discord',
      external_id: message.id,
      author: message.author.tag,
      content: message.content,
      url: message.url,
      posted_at: message.createdTimestamp,
    }

    // Add vector embedding based on configured dimension
    switch (env.EMBEDDING_DIMENSION) {
      case '1536':
        values.content_vector_1536 = embeddingResult.embedding
        break
      case '1024':
        values.content_vector_1024 = embeddingResult.embedding
        break
      case '768':
        values.content_vector_768 = embeddingResult.embedding
        break
      default:
        throw new Error(`Unsupported embedding dimension: ${env.EMBEDDING_DIMENSION}`)
    }

    await db.insert(postsTable).values(values).onConflictDoNothing()

    console.info(`[Discord Collector] Saved message ${message.id} from ${message.author.tag} with embedding`)
  }
  catch (error) {
    console.error(`[Discord Collector] Failed to save message ${message.id}:`, error)
  }
}

/**
 * Fetch and save historical messages from the channel
 * @param channelId - Discord channel ID
 * @param limit - Maximum number of messages to fetch (0 = fetch all available)
 */
async function fetchHistoricalMessages(channelId: string, limit: number): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId)

    if (!channel || !channel.isTextBased()) {
      console.error('[Discord Collector] Channel not found or is not a text channel')
      return
    }

    const textChannel = channel as TextChannel
    const allMessages: Message[] = []

    if (limit === 0) {
      // Fetch all messages using pagination (Discord API limit: 100 per request)
      console.info('[Discord Collector] Fetching ALL historical messages (pagination)...')
      let lastMessageId: string | undefined
      let fetchedCount = 0

      while (true) {
        const fetchOptions = lastMessageId
          ? { limit: 100, before: lastMessageId }
          : { limit: 100 }

        const batch = await textChannel.messages.fetch(fetchOptions)
        if (batch.size === 0)
          break

        allMessages.push(...Array.from(batch.values()))
        fetchedCount += batch.size
        lastMessageId = batch.last()?.id

        console.info(`[Discord Collector] Fetched ${fetchedCount} messages so far...`)

        // Stop if we got fewer than 100 messages (reached the end)
        if (batch.size < 100)
          break
      }

      console.info(`[Discord Collector] Found ${allMessages.length} total messages`)
    }
    else {
      // Fetch limited number of messages
      console.info(`[Discord Collector] Fetching up to ${limit} historical messages...`)
      const messages = await textChannel.messages.fetch({ limit })
      allMessages.push(...Array.from(messages.values()))
      console.info(`[Discord Collector] Found ${allMessages.length} messages`)
    }

    // Save messages in chronological order (oldest first)
    const sortedMessages = allMessages.reverse()

    let savedCount = 0
    for (const message of sortedMessages) {
      // Skip bot messages
      if (message.author.bot)
        continue

      await saveMessage(message)
      savedCount++
    }

    console.info(`[Discord Collector] Saved ${savedCount} historical messages`)
  }
  catch (error) {
    console.error('[Discord Collector] Error fetching historical messages:', error)
  }
}

// Bot ready event
client.on('ready', async () => {
  console.info(`[Discord Collector] Bot logged in as ${client.user?.tag}`)
  console.info(`[Discord Collector] Monitoring channel: ${DISCORD_CHANNEL_ID}`)

  // Fetch historical messages on startup
  await fetchHistoricalMessages(DISCORD_CHANNEL_ID, HISTORICAL_MESSAGE_LIMIT)

  console.info('[Discord Collector] Ready to collect new messages')
})

// Real-time message monitoring
client.on('messageCreate', async (message) => {
  // Skip bot messages
  if (message.author.bot)
    return

  // Only process messages from the target channel
  if (message.channelId !== DISCORD_CHANNEL_ID)
    return

  console.info(`[Discord Collector] New message from ${message.author.tag}`)
  await saveMessage(message)
})

// Error handling
client.on('error', (error) => {
  console.error('[Discord Collector] Discord client error:', error)
})

// Login to Discord
client.login(DISCORD_BOT_TOKEN).catch((error) => {
  console.error('[Discord Collector] Failed to login:', error)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.info('[Discord Collector] Shutting down...')
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.info('[Discord Collector] Shutting down...')
  client.destroy()
  process.exit(0)
})
