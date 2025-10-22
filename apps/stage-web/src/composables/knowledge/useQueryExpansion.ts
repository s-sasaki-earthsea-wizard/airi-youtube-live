/**
 * Query Expansion Composable
 *
 * Uses LLM (Gemini 2.0 Flash Lite) with JSON mode to expand user queries
 * into multiple related keywords for improved Knowledge DB search accuracy.
 *
 * Example:
 * Input: "好きな動物は？"
 * Output: ["動物", "ペット", "犬", "猫", "好き"]
 */

import process from 'node:process'

import { ref } from 'vue'

export interface QueryExpansionConfig {
  enabled: boolean
  model: string
  apiKey: string
  baseUrl: string
}

export interface ExpandedQuery {
  original: string
  keywords: string[]
  expandedAt: number
}

/**
 * Get query expansion configuration from environment variables
 *
 * Note: Supports both Vite (import.meta.env) and Node.js (process.env) environments
 */
function getQueryExpansionConfig(): QueryExpansionConfig {
  // Support both Vite and Node.js environments
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  return {
    enabled: env.VITE_QUERY_EXPANSION_ENABLED === 'true',
    model: env.VITE_QUERY_EXPANSION_MODEL || 'google/gemini-2.0-flash-exp:free',
    apiKey: env.VITE_LLM_API_KEY || '',
    baseUrl: env.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/',
  }
}

export function useQueryExpansion() {
  const config = getQueryExpansionConfig()
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const instructionText = ref<string | null>(null)

  /**
   * Load instruction text from file
   * Loads once and caches the result
   *
   * Supports both browser (fetch) and Node.js (fs) environments
   */
  async function loadInstructionText(): Promise<string> {
    // Return cached version if already loaded
    if (instructionText.value !== null) {
      return instructionText.value
    }

    try {
      // Check if we're in Node.js environment
      const isNode = typeof process !== 'undefined' && process.versions?.node

      let text: string

      if (isNode) {
        // Node.js environment: use fs.readFileSync
        const { readFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        const filePath = join(process.cwd(), 'public/prompts/query-expansion-instruction.md')
        text = readFileSync(filePath, 'utf-8')
      }
      else {
        // Browser environment: use fetch
        const response = await fetch('/prompts/query-expansion-instruction.md')
        if (!response.ok) {
          throw new Error(`Failed to load query expansion instruction: ${response.status}`)
        }
        text = await response.text()
      }

      instructionText.value = text
      return text
    }
    catch (err) {
      console.warn('[useQueryExpansion] Failed to load instruction file, using default', err)
      // Fallback to simple default instruction
      const defaultInstruction = `次の質問から検索に役立つキーワードを抽出してください。
具体的な固有名詞やカテゴリ名を優先し、抽象的な類義語は避けてください。`
      instructionText.value = defaultInstruction
      return defaultInstruction
    }
  }

  /**
   * Expand a query into multiple related keywords using LLM with JSON mode
   *
   * @param query - Original user query
   * @param maxKeywords - Maximum number of keywords to generate (default: 5)
   * @returns Promise with expanded keywords, or null if expansion fails
   */
  async function expandQuery(
    query: string,
    maxKeywords: number = 5,
  ): Promise<string[] | null> {
    // Skip if query expansion is disabled
    if (!config.enabled) {
      console.info('[useQueryExpansion] Query expansion is disabled')
      return null
    }

    // Skip empty queries
    if (!query || query.trim() === '') {
      console.warn('[useQueryExpansion] Empty query provided')
      return null
    }

    // Validate API key
    if (!config.apiKey) {
      console.error('[useQueryExpansion] API key is not configured')
      error.value = new Error('API key is not configured')
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      console.info(`[useQueryExpansion] Expanding query: "${query}"`)

      // Load instruction text
      const instruction = await loadInstructionText()

      const response = await fetch(`${config.baseUrl}chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/moeru-ai/airi',
          'X-Title': 'AIRI YouTube Live',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: `${instruction}

質問: ${query}

最大キーワード数: ${maxKeywords}個`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'keyword_extraction',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  keywords: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    description: 'Array of extracted keywords',
                  },
                },
                required: ['keywords'],
                additionalProperties: false,
              },
            },
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Query expansion failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      // Extract keywords from LLM response
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in LLM response')
      }

      // Parse JSON response
      const parsed = JSON.parse(content)
      const keywords = parsed.keywords

      if (!Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Invalid keywords format in response')
      }

      console.info(`[useQueryExpansion] Expanded to ${keywords.length} keywords:`, keywords)

      return keywords
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[useQueryExpansion] Expansion failed:', errorMessage)
      error.value = err instanceof Error ? err : new Error(errorMessage)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Expand query and return structured result
   *
   * @param query - Original user query
   * @param maxKeywords - Maximum number of keywords to generate
   * @returns Promise with ExpandedQuery object
   */
  async function expandQueryWithMetadata(
    query: string,
    maxKeywords: number = 5,
  ): Promise<ExpandedQuery | null> {
    const keywords = await expandQuery(query, maxKeywords)

    if (!keywords) {
      return null
    }

    return {
      original: query,
      keywords,
      expandedAt: Date.now(),
    }
  }

  return {
    config,
    isLoading,
    error,
    expandQuery,
    expandQueryWithMetadata,
  }
}
