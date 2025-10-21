import process, { env } from 'node:process'

import { Client as AiriClient } from '@proj-airi/server-sdk'

import 'dotenv/config'

async function sendTestMessage() {
  const message = process.argv[2] || 'テストメッセージです'

  console.info('Connecting to AIRI Server...')
  const airiClient = new AiriClient({
    name: 'youtube-bot-test',
    possibleEvents: ['input:text'],
    url: env.AIRI_SERVER_URL || 'ws://localhost:6121/ws',
    token: env.AIRI_SERVER_TOKEN,
  })

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.info(`Sending test message: "${message}"`)
  airiClient.send({
    type: 'input:text',
    data: {
      text: message,
      author: 'Test User',
      source: 'youtube',
      timestamp: new Date().toISOString(),
      youtube: {
        messageType: 'text',
      },
    },
  })

  console.info('Message sent!')

  // Wait a bit before closing
  await new Promise(resolve => setTimeout(resolve, 2000))

  airiClient.close()
  console.info('Connection closed')
  process.exit(0)
}

sendTestMessage().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
