/**
 * LLM-based dynamic topic selection for Knowledge DB results
 *
 * Replaces the reranking approach with a more flexible selection mechanism
 * where the LLM chooses only truly relevant topics (0 to maxResults).
 */

import type { KnowledgeResult } from './useKnowledgeDB'

import process from 'node:process'

export interface SelectionOptions {
  maxResults?: number
  includeReasoning?: boolean
}

export interface SelectionResult {
  selectedResults: KnowledgeResult[]
  reasoning?: string
  totalCandidates: number
  selectedCount: number
}

export function useTopicSelection() {
  // Environment detection
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  const apiKey = env.VITE_LLM_API_KEY
  const baseUrl = env.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/'
  const model = env.VITE_QUERY_EXPANSION_MODEL || 'google/gemini-2.0-flash-lite-001'
  const defaultMaxResults = Number.parseInt(env.VITE_KNOWLEDGE_SELECTION_MAX_RESULTS || '3', 10)

  /**
   * Select relevant topics from search results using LLM
   * The LLM decides which candidates are truly relevant (can be 0 to maxResults)
   *
   * @param query - Original user query
   * @param candidates - Search results to filter
   * @param options - Selection options (maxResults, includeReasoning)
   * @returns Selected relevant topics only
   */
  async function selectRelevantTopics(
    query: string,
    candidates: KnowledgeResult[],
    options: SelectionOptions = {},
  ): Promise<SelectionResult> {
    const { maxResults = defaultMaxResults, includeReasoning = false } = options

    if (candidates.length === 0) {
      return {
        selectedResults: [],
        selectedCount: 0,
        totalCandidates: 0,
      }
    }

    console.info(`[useTopicSelection] Selecting relevant topics from ${candidates.length} candidates (max: ${maxResults})`)

    try {
      const prompt = buildSelectionPrompt(query, candidates, maxResults, includeReasoning)
      const response = await callLLM(prompt, includeReasoning)
      const result = parseSelectionResponse(response, includeReasoning)

      // Validate and map indices to actual results
      const selected = result.selectedIndices
        .filter(idx => idx >= 0 && idx < candidates.length)
        .map(idx => candidates[idx])

      console.info(`[useTopicSelection] Selected ${selected.length}/${candidates.length} topics`)
      if (result.reasoning) {
        console.info(`[useTopicSelection] Reasoning: ${result.reasoning}`)
      }

      return {
        selectedResults: selected,
        reasoning: result.reasoning,
        totalCandidates: candidates.length,
        selectedCount: selected.length,
      }
    }
    catch (error) {
      console.error('[useTopicSelection] Selection failed, returning empty results:', error)
      // On error, return no results rather than all candidates
      // This is safer than potentially including irrelevant content
      return {
        selectedResults: [],
        selectedCount: 0,
        totalCandidates: candidates.length,
      }
    }
  }

  /**
   * Build the selection prompt
   */
  function buildSelectionPrompt(
    query: string,
    candidates: KnowledgeResult[],
    maxResults: number,
    includeReasoning: boolean,
  ): string {
    const candidateList = candidates
      .map((c, i) => {
        const preview = c.content.slice(0, 150).replace(/\n/g, ' ')
        return `${i}. ${preview}${c.content.length > 150 ? '...' : ''}`
      })
      .join('\n')

    return `元の質問: "${query}"

以下の候補の中から、質問に答えるために**本当に必要なもの**だけを選択してください。

候補:
${candidateList}

選択基準:
1. 質問の意図に直接答えられる具体的な内容
2. 質問のキーワードと直接関連する固有名詞や事実
3. 抽象的・間接的な関連は低優先度
4. "好き"などの汎用的な単語だけの一致は避ける
5. 無関係なものは選択しない（0個でも構いません）

制約:
- 最大${maxResults}件まで選択可能
- 本当に関連性が高いものだけを選ぶ
- 疑わしいものは除外する

選択した候補の番号を配列で返してください${includeReasoning ? '。また、選択の理由も簡潔に説明してください' : ''}。`
  }

  /**
   * Call LLM API with appropriate response format
   */
  async function callLLM(prompt: string, includeReasoning: boolean): Promise<string> {
    const schema = includeReasoning
      ? {
          type: 'object',
          properties: {
            selected_indices: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of selected candidate indices (can be empty)',
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of why these candidates were selected',
            },
          },
          required: ['selected_indices', 'reasoning'],
        }
      : {
          type: 'object',
          properties: {
            selected_indices: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of selected candidate indices (can be empty)',
            },
          },
          required: ['selected_indices'],
        }

    const response = await fetch(`${baseUrl}chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'topic_selection_result',
            strict: true,
            schema,
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || '{}'
  }

  /**
   * Parse LLM response
   */
  function parseSelectionResponse(
    responseText: string,
    includeReasoning: boolean,
  ): { selectedIndices: number[], reasoning?: string } {
    try {
      const parsed = JSON.parse(responseText)

      if (!Array.isArray(parsed.selected_indices)) {
        throw new TypeError('Invalid response format: selected_indices is not an array')
      }

      return {
        selectedIndices: parsed.selected_indices,
        reasoning: includeReasoning ? parsed.reasoning : undefined,
      }
    }
    catch (error) {
      console.error('[useTopicSelection] Failed to parse LLM response:', error)
      throw error
    }
  }

  return {
    selectRelevantTopics,
  }
}
