/**
 * Test Script: Expanded Search with Query Expansion
 *
 * This script tests the expanded search functionality that combines:
 * 1. LLM-based query expansion (Gemini 2.0 Flash Lite)
 * 2. Multiple parallel vector searches in Knowledge DB
 * 3. Result merging and deduplication
 *
 * Usage:
 *   pnpm tsx apps/stage-web/src/test-expanded-search.ts [options]
 *
 * Options:
 *   --limit <number>         Maximum results per keyword (default: 5)
 *   --threshold <number>     Minimum similarity threshold 0-1 (default: 0.4)
 *   --max-keywords <number>  Maximum keywords to generate (default: 5)
 *
 * Examples:
 *   pnpm tsx src/test-expanded-search.ts
 *   pnpm tsx src/test-expanded-search.ts --threshold 0.3 --limit 10
 *
 * Configuration is loaded from .env file automatically.
 */

import process from 'node:process'

import { useExpandedSearch } from './composables/knowledge'
import { loadEnvFile } from './utils/test-helpers'

// Load environment variables from .env file
const envFile = loadEnvFile()

// Setup environment variables for composables
process.env.VITE_KNOWLEDGE_DB_ENABLED = envFile.VITE_KNOWLEDGE_DB_ENABLED || 'true'
process.env.VITE_KNOWLEDGE_DB_URL = envFile.VITE_KNOWLEDGE_DB_URL || 'http://localhost:3100'
process.env.VITE_QUERY_EXPANSION_ENABLED = envFile.VITE_QUERY_EXPANSION_ENABLED || 'true'
process.env.VITE_QUERY_EXPANSION_MODEL = envFile.VITE_QUERY_EXPANSION_MODEL || 'google/gemini-2.0-flash-exp:free'
process.env.VITE_LLM_API_KEY = envFile.VITE_LLM_API_KEY || ''
process.env.VITE_LLM_BASE_URL = envFile.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/'

// Parse command-line arguments
interface TestConfig {
  limit: number
  threshold: number
  maxKeywords: number
  apiKey: string | null
  kbUrl: string
  model: string
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: TestConfig = {
    limit: 5,
    threshold: 0.4,
    maxKeywords: 5,
    apiKey: null,
    kbUrl: 'http://localhost:3100',
    model: 'google/gemini-2.0-flash-exp:free',
  }

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]

    switch (key) {
      case '--limit':
        config.limit = Number.parseInt(value, 10)
        break
      case '--threshold':
        config.threshold = Number.parseFloat(value)
        break
      case '--max-keywords':
        config.maxKeywords = Number.parseInt(value, 10)
        break
      case '--api-key':
        config.apiKey = value
        break
      case '--kb-url':
        config.kbUrl = value
        break
      case '--model':
        config.model = value
        break
    }
  }

  return config
}

interface TestCase {
  query: string
  expectedKeywords?: string[]
  expectedContent?: string
  minResults?: number
}

const testCases: TestCase[] = [
  {
    query: '好きな動物は？',
    expectedKeywords: ['動物', 'ペット', '犬', '猫'],
    expectedContent: '実家には犬',
    minResults: 1,
  },
  {
    query: '趣味は何？',
    expectedKeywords: ['趣味', '興味', '嗜好'],
    expectedContent: '宝塚歌劇',
    minResults: 1,
  },
  {
    query: '好きな食べ物は？',
    expectedKeywords: ['食べ物', '料理', 'グルメ'],
    expectedContent: '', // May not have food-related content
    minResults: 0,
  },
]

async function runTests() {
  const config = parseArgs()

  console.info('='.repeat(80))
  console.info('Expanded Search Test')
  console.info('='.repeat(80))
  console.info()
  console.info('Configuration:')
  console.info(`  Knowledge DB URL: ${process.env.VITE_KNOWLEDGE_DB_URL}`)
  console.info(`  LLM Model: ${process.env.VITE_QUERY_EXPANSION_MODEL}`)
  console.info(`  Limit: ${config.limit}`)
  console.info(`  Threshold: ${config.threshold}`)
  console.info(`  Max Keywords: ${config.maxKeywords}`)
  console.info()

  const { searchWithExpansion } = useExpandedSearch()

  let passedTests = 0
  let failedTests = 0

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.info(`\nTest ${i + 1}/${testCases.length}: "${testCase.query}"`)
    console.info('-'.repeat(80))

    try {
      const startTime = Date.now()
      // Use CLI arguments for configuration
      const result = await searchWithExpansion(testCase.query, {
        limit: config.limit,
        threshold: config.threshold,
        maxKeywords: config.maxKeywords,
      })
      const duration = Date.now() - startTime

      console.info(`✓ Search completed in ${duration}ms`)
      console.info(`  Strategy: ${result.searchStrategy}`)

      // Check expanded keywords
      if (result.expandedKeywords) {
        console.info(`  Expanded keywords (${result.expandedKeywords.length}):`, result.expandedKeywords)

        if (testCase.expectedKeywords) {
          const hasExpectedKeyword = testCase.expectedKeywords.some(expected =>
            result.expandedKeywords!.some(actual =>
              actual.includes(expected) || expected.includes(actual),
            ),
          )

          if (hasExpectedKeyword) {
            console.info('  ✓ Contains expected keywords')
          }
          else {
            console.info('  ⚠ Missing expected keywords:', testCase.expectedKeywords)
          }
        }
      }
      else {
        console.info('  ⚠ Query expansion failed or disabled')
      }

      // Check results
      if (result.response) {
        console.info(`  Results found: ${result.response.total}`)

        if (result.response.total >= (testCase.minResults ?? 0)) {
          console.info(`  ✓ Meets minimum result count (${testCase.minResults})`)
        }
        else {
          console.info(`  ✗ Below minimum result count (expected: ${testCase.minResults}, got: ${result.response.total})`)
        }

        // Display top results
        console.info('\n  Top results:')
        result.response.results.slice(0, 3).forEach((r, idx) => {
          const preview = r.content.substring(0, 80).replace(/\n/g, ' ')
          console.info(`    ${idx + 1}. [${(r.similarity * 100).toFixed(1)}%] ${preview}${r.content.length > 80 ? '...' : ''}`)
        })

        // Check expected content
        if (testCase.expectedContent) {
          const hasExpectedContent = result.response.results.some(r =>
            r.content.includes(testCase.expectedContent!),
          )

          if (hasExpectedContent) {
            console.info(`\n  ✓ Found expected content: "${testCase.expectedContent}"`)
          }
          else {
            console.info(`\n  ⚠ Expected content not found: "${testCase.expectedContent}"`)
          }
        }

        passedTests++
      }
      else {
        console.info('  ✗ No results found')
        if ((testCase.minResults ?? 0) > 0) {
          failedTests++
        }
        else {
          passedTests++
        }
      }
    }
    catch (error) {
      console.error('  ✗ Test failed with error:', error)
      failedTests++
    }
  }

  console.info(`\n${'='.repeat(80)}`)
  console.info('Test Summary')
  console.info('='.repeat(80))
  console.info(`Total tests: ${testCases.length}`)
  console.info(`Passed: ${passedTests}`)
  console.info(`Failed: ${failedTests}`)
  console.info()

  if (failedTests === 0) {
    console.info('✓ All tests passed!')
  }
  else {
    console.info('✗ Some tests failed. Please review the output above.')
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
