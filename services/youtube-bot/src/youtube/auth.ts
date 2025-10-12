import type { YouTubeAuthConfig } from '../types'

import process, { env } from 'node:process'
import readline from 'node:readline'

import { OAuth2Client } from 'google-auth-library'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]

/**
 * Create an OAuth2 client with the given credentials
 */
export function createOAuth2Client(config: YouTubeAuthConfig): OAuth2Client {
  const oauth2Client = new OAuth2Client(
    config.clientId,
    config.clientSecret,
    'urn:ietf:wg:oauth:2.0:oob', // For installed apps
  )

  if (config.refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    })
  }

  return oauth2Client
}

/**
 * Generate an authentication URL for the user to visit
 */
export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
}

/**
 * Exchange authorization code for refresh token
 */
export async function getTokensFromCode(oauth2Client: OAuth2Client, code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  return tokens
}

/**
 * Interactive authentication flow for getting a refresh token
 * Run this script directly to generate a refresh token
 */
async function authenticate() {
  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file')
    process.exit(1)
  }

  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob',
  )

  const authUrl = getAuthUrl(oauth2Client)

  console.info('\n=== YouTube Bot Authentication ===\n')
  console.info('1. Visit this URL in your browser:\n')
  console.info(authUrl)
  console.info('\n2. Authorize the application')
  console.info('3. Copy the authorization code and paste it below\n')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.question('Enter the authorization code: ', async (code) => {
    try {
      const tokens = await getTokensFromCode(oauth2Client, code)

      console.info('\n=== Authentication Successful! ===\n')
      console.info('Add the following to your .env file:\n')
      console.info(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
      console.info('\nYou can now start the bot with: pnpm start')
    }
    catch (error) {
      console.error('Error getting tokens:', error)
    }
    finally {
      rl.close()
    }
  })
}

// Run authentication if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  authenticate().catch(console.error)
}
