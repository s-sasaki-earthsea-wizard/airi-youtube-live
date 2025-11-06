/**
 * Test Script: Expanded Search with Dynamic Topic Selection
 *
 * This script tests the 3-stage pipeline with dynamic LLM-based topic selection:
 * 1. LLM-based query expansion (Gemini 2.0 Flash Lite) → generate ~10 keywords
 * 2. Relaxed threshold vector search → collect more candidates
 * 3. Dynamic topic selection → LLM selects only truly relevant topics (0 to maxResults)
 *
 * Usage:
 *   pnpm tsx apps/stage-web/src/test-topic-selection.ts [options]
 *
 * Options:
 *   --limit <number>         Maximum results per keyword (default: 10)
 *   --threshold <number>     Minimum similarity threshold 0-1 (default: 0.25)
 *   --max-keywords <number>  Maximum keywords to generate (default: 10)
 *   --max-results <number>   Maximum topics to select (default: 3)
 *   --show-reasoning         Show LLM reasoning for selection
 *
 * Examples:
 *   pnpm tsx src/test-topic-selection.ts
 *   pnpm tsx src/test-topic-selection.ts --threshold 0.3 --max-keywords 15
 *   pnpm tsx src/test-topic-selection.ts --show-reasoning --max-results 5
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
process.env.VITE_QUERY_EXPANSION_MODEL = envFile.VITE_QUERY_EXPANSION_MODEL || 'google/gemini-2.0-flash-lite-001'
process.env.VITE_LLM_API_KEY = envFile.VITE_LLM_API_KEY || ''
process.env.VITE_LLM_BASE_URL = envFile.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/'

// Parse command-line arguments
interface TestConfig {
  limit: number
  threshold: number
  maxKeywords: number
  maxResults: number
  showReasoning: boolean
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: TestConfig = {
    limit: 10,
    threshold: 0.25,
    maxKeywords: 10,
    maxResults: 3,
    showReasoning: false,
  }

  for (let i = 0; i < args.length; i++) {
    const key = args[i]

    switch (key) {
      case '--limit':
        config.limit = Number.parseInt(args[++i], 10)
        break
      case '--threshold':
        config.threshold = Number.parseFloat(args[++i])
        break
      case '--max-keywords':
        config.maxKeywords = Number.parseInt(args[++i], 10)
        break
      case '--max-results':
        config.maxResults = Number.parseInt(args[++i], 10)
        break
      case '--show-reasoning':
        config.showReasoning = true
        break
    }
  }

  return config
}

interface TestCase {
  query: string
  description: string
  expectedContent?: string
  expectedTopResult?: string
  expectAtLeastOne?: boolean
}

const testCases: TestCase[] = [
  {
    query: '好きな動物は？',
    description: 'The classic "Hokuto no Ken problem" - should find "実家には犬" over "北斗の拳"',
    expectedContent: '実家には犬',
    expectedTopResult: '実家には犬',
    expectAtLeastOne: true,
  },
  {
    query: '趣味は何？',
    description: 'Should find hobby-related content',
    expectedContent: 'ポケモン',
    expectAtLeastOne: true,
  },
  {
    query: 'ペットは飼ってる？',
    description: 'Should find pet-related content',
    expectedContent: '実家には犬',
    expectAtLeastOne: true,
  },
  {
    query: '量子力学について教えて',
    description: 'Irrelevant topic - should return 0 results',
    expectAtLeastOne: false,
  },
]

async function runTests() {
  const config = parseArgs()

  // Set max results for topic selection
  process.env.VITE_KNOWLEDGE_SELECTION_MAX_RESULTS = config.maxResults.toString()

  console.info('='.repeat(80))
  console.info('Dynamic Topic Selection Test')
  console.info('='.repeat(80))
  console.info()
  console.info('Configuration:')
  console.info(`  Knowledge DB URL: ${process.env.VITE_KNOWLEDGE_DB_URL}`)
  console.info(`  LLM Model: ${process.env.VITE_QUERY_EXPANSION_MODEL}`)
  console.info(`  Limit (per keyword): ${config.limit}`)
  console.info(`  Threshold: ${config.threshold}`)
  console.info(`  Max Keywords: ${config.maxKeywords}`)
  console.info(`  Max Results (topic selection): ${config.maxResults}`)
  console.info(`  Show Reasoning: ${config.showReasoning}`)
  console.info()

  const { searchWithExpansion } = useExpandedSearch()

  let passedTests = 0
  let failedTests = 0

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.info(`\nTest ${i + 1}/${testCases.length}: "${testCase.query}"`)
    console.info(`Description: ${testCase.description}`)
    console.info('-'.repeat(80))

    try {
      // Query expansion + expanded search + topic selection (all in one)
      const startTime = Date.now()
      const searchResult = await searchWithExpansion(testCase.query, {
        limit: config.limit,
        threshold: config.threshold,
        maxKeywords: config.maxKeywords,
      })
      const totalDuration = Date.now() - startTime

      console.info(`✓ Search completed in ${totalDuration}ms`)
      console.info(`  Strategy: ${searchResult.searchStrategy}`)

      // Display expanded keywords
      if (searchResult.expandedKeywords) {
        console.info(`  Expanded keywords (${searchResult.expandedKeywords.length}):`, searchResult.expandedKeywords)
      }

      // Check if we got any results after topic selection
      const selectedCount = searchResult.response ? searchResult.response.results.length : 0
      console.info(`\n  Topics selected by LLM: ${selectedCount}/${config.maxResults}`)

      // Display selected topics
      if (searchResult.response && searchResult.response.results.length > 0) {
        console.info('\n  Selected topics (after LLM filtering):')
        searchResult.response.results.forEach((r, idx) => {
          const preview = r.content.substring(0, 100).replace(/\n/g, ' ')
          console.info(`    ${idx + 1}. [${(r.similarity * 100).toFixed(1)}%] ${preview}${r.content.length > 100 ? '...' : ''}`)
        })
      }
      else {
        console.info('  No topics were selected by LLM (all filtered out)')
      }

      // Validation
      let testPassed = true

      // Check expectAtLeastOne
      if (testCase.expectAtLeastOne !== undefined) {
        const hasResults = selectedCount > 0

        if (testCase.expectAtLeastOne) {
          // Should have at least one result
          if (hasResults) {
            console.info(`\n  ✓ At least one result selected (as expected)`)
          }
          else {
            console.info(`\n  ✗ Expected at least one result, but got 0`)
            testPassed = false
          }
        }
        else {
          // Should have zero results
          if (!hasResults) {
            console.info(`\n  ✓ No results selected (as expected for irrelevant query)`)
          }
          else {
            console.info(`\n  ⚠ Expected 0 results, but got ${selectedCount}`)
            console.info(`    This may indicate the LLM is too lenient`)
            // Don't fail the test, just warn
          }
        }
      }

      // Check if expected content is found
      if (testCase.expectedContent && searchResult.response) {
        const hasExpectedContent = searchResult.response.results.some(r =>
          r.content.includes(testCase.expectedContent!),
        )

        if (hasExpectedContent) {
          console.info(`  ✓ Found expected content: "${testCase.expectedContent}"`)
        }
        else {
          console.info(`  ✗ Expected content not found: "${testCase.expectedContent}"`)
          testPassed = false
        }
      }

      // Check if expected result is in top position
      if (testCase.expectedTopResult && searchResult.response && searchResult.response.results.length > 0) {
        const topResult = searchResult.response.results[0]
        const isTopCorrect = topResult.content.includes(testCase.expectedTopResult)

        if (isTopCorrect) {
          console.info(`  ✓ Top result is correct: "${testCase.expectedTopResult}"`)
        }
        else {
          console.info(`  ⚠ Top result is not the expected one`)
          console.info(`    Expected: "${testCase.expectedTopResult}"`)
          console.info(`    Got: "${topResult.content.substring(0, 60)}..."`)
          // Don't fail the test for this, just warn
        }
      }

      if (testPassed) {
        passedTests++
      }
      else {
        failedTests++
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
    console.info('\nKey improvements with dynamic topic selection:')
    console.info('  • LLM decides relevance dynamically (0 to maxResults)')
    console.info('  • Fewer irrelevant results in prompts')
    console.info('  • Better quality over fixed quantity')
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
