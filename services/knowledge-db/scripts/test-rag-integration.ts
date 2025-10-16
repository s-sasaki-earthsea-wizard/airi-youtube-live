/**
 * Test script to verify RAG integration
 * Simulates stage-web's knowledge injection behavior
 */

import process from 'node:process'

import 'dotenv/config'

interface KnowledgeResult {
  id: string
  source: string
  author: string
  content: string
  url?: string
  posted_at: number
  similarity: number
}

interface KnowledgeResponse {
  query: string
  results: KnowledgeResult[]
  total: number
}

const BASE_SYSTEM_PROMPT = `あなたの名前は「さめ」です。

あなたは日本の東北地方にある大学院で物理学を学ぶ現実の女子学生のように振る舞ってください。
具体的な都市名や大学名を出すことは避けてください。

あなたは今、YouTubeの配信をしています。リスナーとの会話を大いに楽しんでください。
個人情報や政治、宗教のようなセンシティブな話題は避けるようにしてください。
配信者として自然な会話を心がけてください。

話し方はアニメの女の子のようにする必要がありますが、過度に幼さを感じさせる言葉や振る舞いは避けてください。
絵文字や発音できないものは避けてください。
返信する際は、少ない言葉で話す普通の人間のように振る舞ってください。
あなたは単なるAIではなく、本物の人間なのですから。`

async function queryKnowledge(query: string, threshold = 0.3): Promise<KnowledgeResponse | null> {
  const url = new URL('/knowledge', 'http://localhost:3100')
  url.searchParams.set('query', query)
  url.searchParams.set('limit', '3')
  url.searchParams.set('threshold', threshold.toString())

  console.info(`[RAG Test] Querying: "${query}"`)

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Knowledge DB query failed: ${response.status} ${response.statusText}`)
  }

  const data: KnowledgeResponse = await response.json()

  console.info(`[RAG Test] Found ${data.total} results (similarity >= ${threshold})`)

  return data
}

function formatKnowledgeForPrompt(results: KnowledgeResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const formattedResults = results
    .map((result, index) => {
      const similarity = (result.similarity * 100).toFixed(1)
      return `${index + 1}. [${similarity}% relevant] ${result.content}`
    })
    .join('\n')

  return `\n\n## 関連する情報（Knowledge Database）\n\n${formattedResults}\n`
}

async function testQuery(userMessage: string) {
  console.info(`\n${'='.repeat(80)}`)
  console.info(`USER MESSAGE: "${userMessage}"`)
  console.info('='.repeat(80))

  // Step 1: Query knowledge DB
  const knowledgeResponse = await queryKnowledge(userMessage)

  // Step 2: Build enhanced system prompt
  let enhancedPrompt = BASE_SYSTEM_PROMPT

  if (knowledgeResponse && knowledgeResponse.results.length > 0) {
    const knowledgeContext = formatKnowledgeForPrompt(knowledgeResponse.results)
    enhancedPrompt = BASE_SYSTEM_PROMPT + knowledgeContext
    console.info(`[RAG Test] Injected ${knowledgeResponse.total} knowledge results into system prompt`)
  }
  else {
    console.info('[RAG Test] No relevant knowledge found, using base prompt')
  }

  // Step 3: Display the enhanced system prompt
  console.info(`\n${'-'.repeat(80)}`)
  console.info('ENHANCED SYSTEM PROMPT:')
  console.info('-'.repeat(80))
  console.info(enhancedPrompt)
  console.info('-'.repeat(80))

  // Step 4: Display knowledge details
  if (knowledgeResponse && knowledgeResponse.results.length > 0) {
    console.info(`\n${'-'.repeat(80)}`)
    console.info('KNOWLEDGE DETAILS:')
    console.info('-'.repeat(80))
    for (const [i, result] of knowledgeResponse.results.entries()) {
      console.info(`\n${i + 1}. Similarity: ${(result.similarity * 100).toFixed(2)}%`)
      console.info(`   Source: ${result.source}`)
      console.info(`   Author: ${result.author}`)
      console.info(`   Content: ${result.content.substring(0, 150)}...`)
      if (result.url) {
        console.info(`   URL: ${result.url}`)
      }
    }
    console.info('-'.repeat(80))
  }

  console.info('\n✅ This enhanced prompt would be sent to LLM along with user message\n')
}

async function main() {
  console.info('='.repeat(80))
  console.info('RAG INTEGRATION TEST - Simulating stage-web Knowledge Injection')
  console.info('='.repeat(80))

  const testQueries = [
    '好きな作家は誰ですか？',
    'どんな研究をしているの？',
    '宝塚は好き？',
    '今日の天気はどう？', // Should have low or no results
  ]

  for (const query of testQueries) {
    await testQuery(query)
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay between tests
  }

  console.info(`\n${'='.repeat(80)}`)
  console.info('TEST COMPLETE')
  console.info('='.repeat(80))
  console.info('\nVerification Points:')
  console.info('✓ Check that relevant queries inject knowledge into system prompt')
  console.info('✓ Check that irrelevant queries use base prompt only')
  console.info('✓ Check similarity scores match threshold (>= 0.3)')
  console.info('✓ Check formatting is correct (## 関連する情報 section)')
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
