/**
 * AIRI Server Integration Test Script
 *
 * Send messages directly to AIRI Server without using YouTube API
 * to test integration with stage-web.
 *
 * Usage:
 *   pnpm test-message "Hello"
 */

import process, { env } from 'node:process'

import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { Client as AiriClient } from '@proj-airi/server-sdk'

import 'dotenv/config'

setGlobalFormat(Format.Pretty)
setGlobalLogLevel(LogLevel.Debug)

const log = useLogg('TestMessage').useGlobalConfig()

async function main() {
  const message = process.argv[2] || 'Test message'

  log.log('AIRI Server test client started')
  log.withField('message', message).log('Message to send')

  // Connect to AIRI Server
  const airiClient = new AiriClient({
    name: 'test-client',
    possibleEvents: ['input:text', 'output:text', 'output:audio'],
    url: env.AIRI_SERVER_URL || 'ws://localhost:6121/ws',
    token: env.AIRI_SERVER_TOKEN,
  })

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000))

  log.log('Connected to AIRI Server')

  // 1. Send user comment (input:text)
  log.log('1. Sending input:text event (user comment)')
  await airiClient.send({
    type: 'input:text',
    data: {
      text: message,
      author: 'Test User',
      source: 'test',
      timestamp: new Date().toISOString(),
    },
  })

  log.log('✅ Sent input:text event')

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 2. Send AI response (output:text)
  const responseText = `Hello! I received your message: "${message}"`

  log.log('2. Sending output:text event (AI response)')
  await airiClient.send({
    type: 'output:text',
    data: {
      text: responseText,
      author: 'AIRI',
      source: 'test',
    },
  })

  log.log('✅ Sent output:text event')

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 3. Send audio URL (output:audio)
  // Note: Actual audio file doesn't exist, but testing the event flow
  log.log('3. Sending output:audio event (audio URL)')
  await airiClient.send({
    type: 'output:audio',
    data: {
      audioUrl: 'http://localhost:3000/audio/test.mp3',
      text: responseText,
    },
  })

  log.log('✅ Sent output:audio event')

  // Wait 2 seconds before exit
  await new Promise(resolve => setTimeout(resolve, 2000))

  log.log('Test complete! Check if messages are displayed in stage-web.')

  airiClient.close()
  process.exit(0)
}

main().catch((err) => {
  log.withError(err).error('An error occurred')
  process.exit(1)
})
