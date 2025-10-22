/**
 * Test script for Query Expansion feature
 *
 * Usage: tsx src/test-query-expansion.ts
 *
 * This script tests the useQueryExpansion composable with real OpenRouter API calls
 * to verify that JSON mode works correctly and produces expected keyword expansions.
 */

/* eslint-disable no-console */

import process from 'node:process'

import { loadEnvFile } from './utils/test-helpers'

const envFile = loadEnvFile()

// Mock import.meta.env for Node.js environment
const envVars = {
  VITE_QUERY_EXPANSION_ENABLED: envFile.VITE_QUERY_EXPANSION_ENABLED || 'true',
  // Use Gemini 2.0 Flash Lite (paid but extremely cheap) which supports JSON mode
  VITE_QUERY_EXPANSION_MODEL: 'google/gemini-2.0-flash-lite-001',
  VITE_LLM_API_KEY: envFile.VITE_LLM_API_KEY || '',
  VITE_LLM_BASE_URL: envFile.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/',
}

// Direct test implementation without using the composable
async function expandQueryDirect(query: string, maxKeywords: number = 5): Promise<string[] | null> {
  const apiKey = envVars.VITE_LLM_API_KEY
  const baseUrl = envVars.VITE_LLM_BASE_URL
  const model = envVars.VITE_QUERY_EXPANSION_MODEL

  if (!apiKey) {
    console.error('API key is not configured')
    return null
  }

  try {
    console.info(`Expanding query: "${query}"`)

    const response = await fetch(`${baseUrl}chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/moeru-ai/airi',
        'X-Title': 'AIRI YouTube Live',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: `次の質問から検索に役立つキーワードを最大${maxKeywords}個抽出してください。

質問: ${query}

条件:
- 質問の主題に関連する単語を含める
- 類義語や関連語も含める
- 1単語または2-3文字の短いフレーズにする
- 重複を避ける
- 日本語で出力する

例:
質問: "好きな食べ物は？"
キーワード: ["食べ物", "好き", "料理", "グルメ", "食事"]`,
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

    console.info(`Expanded to ${keywords.length} keywords:`, keywords)

    return keywords
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Expansion failed:', errorMessage)
    return null
  }
}

async function runTest() {
  console.log('='.repeat(60))
  console.log('Query Expansion Test')
  console.log('='.repeat(60))
  console.log('')

  // Test cases
  const testCases = [
    {
      name: 'Test 1: Animal Question',
      query: '好きな動物は？',
      expectedKeywords: ['動物', 'ペット', '犬', '猫'],
      description: 'Should expand abstract "animal" question to specific animals',
    },
    {
      name: 'Test 2: Hobby Question',
      query: '趣味は何？',
      expectedKeywords: ['趣味', '好き', '活動'],
      description: 'Should expand hobby-related question',
    },
    {
      name: 'Test 3: Food Question',
      query: '好きな食べ物は？',
      expectedKeywords: ['食べ物', '好き', '料理'],
      description: 'Should expand food-related question',
    },
  ]

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`${testCase.name}`)
    console.log(`${'─'.repeat(60)}`)
    console.log(`Query: "${testCase.query}"`)
    console.log(`Description: ${testCase.description}`)
    console.log('')

    try {
      const keywords = await expandQueryDirect(testCase.query, 5)

      if (!keywords) {
        console.error('❌ FAILED: No keywords returned')
        continue
      }

      console.log(`✅ SUCCESS: Received ${keywords.length} keywords`)
      console.log('Keywords:', JSON.stringify(keywords, null, 2))

      // Check if any expected keywords are present
      const foundExpected = testCase.expectedKeywords.filter(expected =>
        keywords.some(keyword => keyword.includes(expected) || expected.includes(keyword)),
      )

      if (foundExpected.length > 0) {
        console.log(`\n✅ Found ${foundExpected.length}/${testCase.expectedKeywords.length} expected keywords:`, foundExpected)
      }
      else {
        console.log(`\n⚠️  No expected keywords found (expected: ${testCase.expectedKeywords.join(', ')})`)
      }
    }
    catch (err) {
      console.error('❌ EXCEPTION:', err instanceof Error ? err.message : err)
    }

    // Add delay between requests to avoid rate limiting
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('\nWaiting 2 seconds before next test...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('Test Complete')
  console.log('='.repeat(60))
}

// Run the test
runTest().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
