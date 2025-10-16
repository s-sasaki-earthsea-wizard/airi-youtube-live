/**
 * Test script to evaluate appropriate similarity threshold
 * Tests various queries against knowledge database to understand similarity scores
 */

import process from 'node:process'

import { embed } from '@xsai/embed'
import { sql } from 'drizzle-orm'

import { db } from '../src/db/client.js'
import { postsTable } from '../src/db/schema.js'

import 'dotenv/config'

interface TestQuery {
  category: string
  query: string
  expectedMatch: string
}

const testQueries: TestQuery[] = [
  // Exact topic matches
  { category: '完全一致', query: '好きな作家は誰ですか？', expectedMatch: 'ル=グウィン' },
  { category: '完全一致', query: '宝塚について教えて', expectedMatch: '宝塚歌劇' },
  { category: '完全一致', query: 'どんな研究してるの？', expectedMatch: 'プラズマ研究' },
  { category: '完全一致', query: 'YouTubeで何を見てる？', expectedMatch: 'バキ童チャンネル' },

  // Related topic matches
  { category: '関連トピック', query: 'おすすめの本はありますか？', expectedMatch: '作家' },
  { category: '関連トピック', query: '演劇は好き？', expectedMatch: '宝塚' },
  { category: '関連トピック', query: '大学では何を専攻してるの？', expectedMatch: '物理学' },
  { category: '関連トピック', query: '面白い動画教えて', expectedMatch: 'YouTube' },

  // Peripheral matches
  { category: '周辺トピック', query: 'SF小説は読む？', expectedMatch: 'ル=グウィン' },
  { category: '周辺トピック', query: '舞台は好き？', expectedMatch: '宝塚' },
  { category: '周辺トピック', query: '理系なんだ？', expectedMatch: '物理学' },

  // Unrelated queries (should have low similarity)
  { category: '無関係', query: '今日の天気はどう？', expectedMatch: 'なし' },
  { category: '無関係', query: '好きな食べ物は？', expectedMatch: 'なし' },
  { category: '無関係', query: 'スポーツは好き？', expectedMatch: 'なし' },
]

async function testQuery(query: string): Promise<Array<{ content: string, similarity: number }>> {
  // Generate embedding for the query
  const embeddingResult = await embed({
    baseURL: process.env.EMBEDDING_API_BASE_URL!,
    apiKey: process.env.EMBEDDING_API_KEY!,
    model: process.env.EMBEDDING_MODEL!,
    input: query,
  })

  const queryVector = embeddingResult.embedding
  const vectorString = `[${queryVector.join(',')}]`

  // Perform vector similarity search
  const results = await db
    .select({
      content: postsTable.content,
      similarity: sql<number>`1 - (${postsTable.content_vector_1536} <=> ${vectorString}::vector)`,
    })
    .from(postsTable)
    .where(sql`${postsTable.content_vector_1536} IS NOT NULL`)
    .orderBy(sql`${postsTable.content_vector_1536} <=> ${vectorString}::vector`)
    .limit(3)

  return results.map(r => ({
    content: r.content.substring(0, 50).replace(/\n/g, ' '),
    similarity: r.similarity,
  }))
}

async function main() {
  console.info('=== Knowledge DB Similarity Threshold Analysis ===\n')

  const resultsByCategory: Record<string, Array<{ query: string, topSimilarity: number, results: any[] }>> = {}

  for (const test of testQueries) {
    console.info(`Query: "${test.query}"`)
    console.info(`Expected: ${test.expectedMatch}`)

    const results = await testQuery(test.query)

    console.info('Top 3 results:')
    for (const [i, result] of results.entries()) {
      console.info(`  ${i + 1}. [${result.similarity.toFixed(4)}] ${result.content}...`)
    }
    console.info('')

    // Store results by category
    if (!resultsByCategory[test.category]) {
      resultsByCategory[test.category] = []
    }
    resultsByCategory[test.category].push({
      query: test.query,
      topSimilarity: results[0].similarity,
      results,
    })
  }

  // Summary statistics
  console.info('\n=== Summary by Category ===\n')

  for (const [category, results] of Object.entries(resultsByCategory)) {
    const similarities = results.map(r => r.topSimilarity)
    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length
    const min = Math.min(...similarities)
    const max = Math.max(...similarities)

    console.info(`${category}:`)
    console.info(`  平均類似度: ${avg.toFixed(4)}`)
    console.info(`  最小値: ${min.toFixed(4)}`)
    console.info(`  最大値: ${max.toFixed(4)}`)
    console.info('')
  }

  // Threshold recommendations
  console.info('=== Recommended Thresholds ===\n')
  console.info('閾値 0.3: 周辺トピックも含めて広く検索（偽陽性が増える可能性）')
  console.info('閾値 0.4: 関連トピックをカバーしつつバランス')
  console.info('閾値 0.5: 完全一致に近い高精度（現在の設定）')
  console.info('閾値 0.6: 非常に厳密な一致のみ（偽陰性が増える可能性）')
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
