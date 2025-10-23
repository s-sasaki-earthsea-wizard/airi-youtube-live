/**
 * Test Helper Utilities
 *
 * Common utilities for test scripts running in Node.js environment
 */

import process from 'node:process'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Load environment variables from .env file
 *
 * Reads the .env file from the current working directory and parses it.
 * Skips comments and empty lines.
 * Removes quotes from values if present.
 *
 * @returns Object containing environment variables from .env file
 *
 * @example
 * const env = loadEnvFile()
 * const apiKey = env.VITE_LLM_API_KEY
 */
export function loadEnvFile(): Record<string, string> {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const envVars: Record<string, string> = {}

    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }

      // Parse key=value format
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith('\'') && value.endsWith('\''))
        ) {
          value = value.slice(1, -1)
        }

        envVars[key] = value
      }
    })

    return envVars
  }
  catch (err) {
    console.error('Failed to load .env file:', err)
    return {}
  }
}
