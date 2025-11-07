import process from 'node:process'

import { config } from 'dotenv'

// Load .env file
config()

/**
 * Configuration for LLM provider
 */
export interface LLMConfig {
  provider: string
  apiKey: string
  baseURL?: string
  model: string
}

/**
 * Load LLM configuration from environment variables
 */
export function loadLLMConfig(): LLMConfig {
  const provider = process.env.LLM_PROVIDER || 'openrouter-ai'
  const apiKey = process.env.LLM_API_KEY
  const baseURL = process.env.LLM_BASE_URL
  const model = process.env.VITE_LLM_MODEL || 'google/gemini-2.0-flash-exp:free'

  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set in environment variables')
  }

  return {
    provider,
    apiKey,
    baseURL,
    model,
  }
}

/**
 * Log level configuration
 */
export const LOG_LEVEL = process.env.LOG_LEVEL || 'log'
