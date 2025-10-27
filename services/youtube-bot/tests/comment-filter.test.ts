/**
 * Manual test script for CommentFilter
 *
 * Run with: pnpm test-comment-filter
 * Or: tsx tests/comment-filter.test.ts
 */

import process from 'node:process'

import { CommentFilter } from '../src/filters/comment-filter'

// Test cases
interface TestCase {
  text: string
  expected: boolean
  category: string
}

const testCases: TestCase[] = [
  // Noise patterns - should be filtered (false)
  { text: 'www', expected: false, category: 'Laugh pattern' },
  { text: 'WWWW', expected: false, category: 'Laugh pattern (uppercase)' },
  { text: 'wwwww', expected: false, category: 'Laugh pattern (long)' },
  { text: 'ｗｗｗ', expected: false, category: 'Laugh pattern (full-width)' },
  { text: '草', expected: false, category: 'Laugh expression' },
  { text: '草草草', expected: false, category: 'Laugh expression (multiple)' },
  { text: '笑笑笑', expected: false, category: 'Laugh expression' },
  { text: '笑www', expected: false, category: 'Mixed laugh pattern' },
  { text: '88888', expected: false, category: 'Clap pattern' },
  { text: '888888888', expected: false, category: 'Clap pattern (long)' },
  { text: 'lol', expected: false, category: 'Laugh (English)' },
  { text: 'lolol', expected: false, category: 'Laugh (English, repeated)' },
  { text: 'あ', expected: false, category: 'Too short' },
  { text: 'w', expected: false, category: 'Too short' },
  { text: 'うん', expected: false, category: 'Too short' },
  { text: '!!!', expected: false, category: 'Punctuation only' },
  { text: '？？？', expected: false, category: 'Punctuation only' },
  { text: '。。。', expected: false, category: 'Punctuation only' },
  { text: 'ウケる', expected: false, category: 'Noise word' },
  { text: '面白い', expected: false, category: 'Noise word' },
  { text: 'へー', expected: false, category: 'Noise word' },
  { text: 'はい', expected: false, category: 'Noise word' },
  { text: 'おk', expected: false, category: 'Noise word' },

  // Meaningful comments - should pass (true)
  { text: 'この曲何ですか？', expected: true, category: 'Question' },
  { text: 'どうやって使うの?', expected: true, category: 'Question' },
  { text: '次回の配信はいつですか？', expected: true, category: 'Question' },
  { text: '今日の配信すごく面白いです！', expected: true, category: 'Long comment (15+ chars)' },
  { text: 'その考え方いいですね', expected: true, category: 'Opinion' },
  { text: 'この機能便利ですね', expected: true, category: 'Opinion' },
  { text: 'おすすめの本教えてください', expected: true, category: 'Request' },
  { text: 'ありがとうございます', expected: true, category: 'Gratitude' },

  // Edge cases
  { text: 'あいう', expected: true, category: 'Edge: exactly 3 chars' },
  { text: '  www  ', expected: false, category: 'Edge: whitespace around noise' },
  { text: '  草  ', expected: false, category: 'Edge: whitespace around noise' },
  { text: 'こんにちは\nwww', expected: true, category: 'Edge: multiline with noise' },
  { text: '', expected: false, category: 'Edge: empty string' },
  { text: '   ', expected: false, category: 'Edge: whitespace only' },
]

// Run tests
function runTests() {
  const filter = new CommentFilter({
    enabled: true,
    minLength: 3,
    logFiltered: false, // Don't log during tests
  })

  console.info('=== Comment Filter Test Suite ===\n')

  let passed = 0
  let failed = 0
  const failures: { testCase: TestCase, result: any }[] = []

  testCases.forEach((testCase) => {
    const result = filter.shouldRespond(testCase.text)
    const isCorrect = result.shouldRespond === testCase.expected

    if (isCorrect) {
      passed++
      console.info(`✅ PASS: "${testCase.text}" (${testCase.category})`)
    }
    else {
      failed++
      failures.push({ testCase, result })
      console.info(`❌ FAIL: "${testCase.text}" (${testCase.category})`)
      console.info(`   Expected: ${testCase.expected}, Got: ${result.shouldRespond}`)
      console.info(`   Reason: ${result.reason}`)
      console.info(`   Pattern: ${result.matchedPattern || 'N/A'}`)
    }
  })

  console.info('\n=== Test Summary ===')
  console.info(`Total: ${testCases.length}`)
  console.info(`Passed: ${passed} (${((passed / testCases.length) * 100).toFixed(1)}%)`)
  console.info(`Failed: ${failed} (${((failed / testCases.length) * 100).toFixed(1)}%)`)

  if (failures.length > 0) {
    console.info('\n=== Failed Tests ===')
    failures.forEach(({ testCase, result }) => {
      console.info(`- "${testCase.text}" (${testCase.category})`)
      console.info(`  Expected: ${testCase.expected}, Got: ${result.shouldRespond}`)
      console.info(`  Reason: ${result.reason}\n`)
    })
  }

  return failed === 0
}

// Interactive test mode
function interactiveTest() {
  const filter = new CommentFilter({
    enabled: true,
    minLength: 3,
    logFiltered: true,
  })

  console.info('\n=== Interactive Test Mode ===')
  console.info('Enter comments to test (Ctrl+C to exit):\n')

  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', (data) => {
    const text = data.toString().trim()
    if (!text)
      return

    const result = filter.shouldRespond(text)
    const icon = result.shouldRespond ? '✅' : '❌'

    console.info(`${icon} "${text}"`)
    console.info(`   Should respond: ${result.shouldRespond}`)
    console.info(`   Reason: ${result.reason}`)
    if (result.matchedPattern) {
      console.info(`   Pattern: ${result.matchedPattern}`)
    }
    console.info()
  })
}

// Main
const args = process.argv.slice(2)

if (args.includes('--interactive') || args.includes('-i')) {
  interactiveTest()
}
else {
  const success = runTests()
  process.exit(success ? 0 : 1)
}
