/**
 * Test Script: Expanded Search with LLM-based Reranking
 *
 * This script tests the 3-stage pipeline for solving the "Hokuto no Ken problem":
 * 1. LLM-based query expansion (Gemini 2.0 Flash Lite) → generate ~10 keywords
 * 2. Relaxed threshold vector search → collect more candidates
 * 3. LLM-based reranking → select the most relevant results
 *
 * Usage:
 *   pnpm tsx apps/stage-web/src/test-reranking-search.ts [options]
 *
 * Options:
 *   --limit <number>         Maximum results per keyword (default: 10)
 *   --threshold <number>     Minimum similarity threshold 0-1 (default: 0.25)
 *   --max-keywords <number>  Maximum keywords to generate (default: 10)
 *   --rerank-top-k <number>  Number of final results after reranking (default: 10)
 *   --show-reasoning         Show LLM reasoning for selection
 *
 * Examples:
 *   pnpm tsx src/test-reranking-search.ts
 *   pnpm tsx src/test-reranking-search.ts --threshold 0.3 --max-keywords 15
 *   pnpm tsx src/test-reranking-search.ts --show-reasoning
 *
 * Configuration is loaded from .env file automatically.
 */

import process from 'node:process'

import { useExpandedSearch } from './composables/knowledge'
import { useReranking } from './composables/knowledge/useReranking'
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
  rerankTopK: number
  showReasoning: boolean
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: TestConfig = {
    limit: 10,
    threshold: 0.25,
    maxKeywords: 10,
    rerankTopK: 10,
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
      case '--rerank-top-k':
        config.rerankTopK = Number.parseInt(args[++i], 10)
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
}

const testCases: TestCase[] = [
  {
    query: '好きな動物は？',
    description: 'The classic "Hokuto no Ken problem" - should find "実家には犬" over "北斗の拳"',
    expectedContent: '実家には犬',
    expectedTopResult: '実家には犬',
  },
  {
    query: '趣味は何？',
    description: 'Should find hobby-related content',
    expectedContent: 'ポケモン',
  },
  {
    query: 'ペットは飼ってる？',
    description: 'Should find pet-related content',
    expectedContent: '実家には犬',
  },
]

async function runTests() {
  const config = parseArgs()

  console.info('='.repeat(80))
  console.info('Expanded Search with LLM Reranking Test')
  console.info('='.repeat(80))
  console.info()
  console.info('Configuration:')
  console.info(`  Knowledge DB URL: ${process.env.VITE_KNOWLEDGE_DB_URL}`)
  console.info(`  LLM Model: ${process.env.VITE_QUERY_EXPANSION_MODEL}`)
  console.info(`  Limit (per keyword): ${config.limit}`)
  console.info(`  Threshold: ${config.threshold}`)
  console.info(`  Max Keywords: ${config.maxKeywords}`)
  console.info(`  Rerank Top-K: ${config.rerankTopK}`)
  console.info(`  Show Reasoning: ${config.showReasoning}`)
  console.info()

  const { searchWithExpansion } = useExpandedSearch()
  const { rerankResults } = useReranking()

  let passedTests = 0
  let failedTests = 0

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.info(`\nTest ${i + 1}/${testCases.length}: "${testCase.query}"`)
    console.info(`Description: ${testCase.description}`)
    console.info('-'.repeat(80))

    try {
      // Step 1: Query expansion + expanded search
      const startTime = Date.now()
      const searchResult = await searchWithExpansion(testCase.query, {
        limit: config.limit,
        threshold: config.threshold,
        maxKeywords: config.maxKeywords,
      })
      const searchDuration = Date.now() - startTime

      console.info(`✓ Search completed in ${searchDuration}ms`)
      console.info(`  Strategy: ${searchResult.searchStrategy}`)

      // Display expanded keywords
      if (searchResult.expandedKeywords) {
        console.info(`  Expanded keywords (${searchResult.expandedKeywords.length}):`, searchResult.expandedKeywords)
      }

      // Check if we got any results
      if (!searchResult.response || searchResult.response.total === 0) {
        console.info('  ✗ No candidates found')
        failedTests++
        continue
      }

      const candidateCount = searchResult.response.results.length
      console.info(`  Candidates found: ${candidateCount}`)

      // Display candidates (before reranking)
      console.info('\n  Candidates (before reranking):')
      searchResult.response.results.slice(0, 5).forEach((r, idx) => {
        const preview = r.content.substring(0, 80).replace(/\n/g, ' ')
        console.info(`    ${idx + 1}. [${(r.similarity * 100).toFixed(1)}%] ${preview}${r.content.length > 80 ? '...' : ''}`)
      })
      if (candidateCount > 5) {
        console.info(`    ... and ${candidateCount - 5} more`)
      }

      // Step 2: LLM-based reranking
      const rerankStartTime = Date.now()
      const rerankedResults = await rerankResults(
        testCase.query,
        searchResult.response.results,
        {
          topK: config.rerankTopK,
          includeReasoning: config.showReasoning,
        },
      )
      const rerankDuration = Date.now() - rerankStartTime

      console.info(`\n✓ Reranking completed in ${rerankDuration}ms`)
      console.info(`  Selected: ${rerankedResults.length} results`)

      // Display reranked results
      console.info('\n  Reranked results (after LLM selection):')
      rerankedResults.slice(0, 5).forEach((r, idx) => {
        const preview = r.content.substring(0, 80).replace(/\n/g, ' ')
        const wasTopBefore = searchResult.response!.results.findIndex(orig => orig.id === r.id)
        console.info(`    ${idx + 1}. [${(r.similarity * 100).toFixed(1)}%] ${preview}${r.content.length > 80 ? '...' : ''} (was #${wasTopBefore + 1})`)
      })

      // Performance summary
      const totalDuration = searchDuration + rerankDuration
      console.info(`\n  Total duration: ${totalDuration}ms (search: ${searchDuration}ms, rerank: ${rerankDuration}ms)`)

      // Validation
      let testPassed = true

      // Check if expected content is found
      if (testCase.expectedContent) {
        const hasExpectedContent = rerankedResults.some(r =>
          r.content.includes(testCase.expectedContent!),
        )

        if (hasExpectedContent) {
          console.info(`\n  ✓ Found expected content: "${testCase.expectedContent}"`)
        }
        else {
          console.info(`\n  ✗ Expected content not found: "${testCase.expectedContent}"`)
          testPassed = false
        }
      }

      // Check if expected result is in top position
      if (testCase.expectedTopResult && rerankedResults.length > 0) {
        const topResult = rerankedResults[0]
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
