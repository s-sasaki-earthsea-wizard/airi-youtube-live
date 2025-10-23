/**
 * LLM-based reranking for Knowledge DB search results
 *
 * Uses a lightweight LLM to select the most relevant results from candidates,
 * addressing the "Hokuto no Ken problem" where high-similarity but irrelevant
 * results rank higher than lower-similarity but highly relevant ones.
 */

import type { KnowledgeResult } from './useKnowledgeDB'

import process from 'node:process'

interface RerankingOptions {
  topK?: number
  includeReasoning?: boolean
}

interface RerankingResult {
  selectedIndices: number[]
  reasoning?: string
}

export function useReranking() {
  // Environment detection
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env

  const apiKey = env.VITE_LLM_API_KEY
  const baseUrl = env.VITE_LLM_BASE_URL || 'https://openrouter.ai/api/v1/'
  const model = env.VITE_QUERY_EXPANSION_MODEL || 'google/gemini-2.0-flash-lite-001'

  /**
   * Rerank search results using LLM to select the most relevant candidates
   *
   * @param query - Original user query
   * @param candidates - Search results to rerank
   * @param options - Reranking options (topK, includeReasoning)
   * @returns Reranked results in order of relevance
   */
  async function rerankResults(
    query: string,
    candidates: KnowledgeResult[],
    options: RerankingOptions = {},
  ): Promise<KnowledgeResult[]> {
    const { topK = 10, includeReasoning = false } = options

    if (candidates.length === 0) {
      return []
    }

    // If candidates are fewer than topK, return all without LLM call
    if (candidates.length <= topK) {
      return candidates
    }

    try {
      const prompt = buildRerankingPrompt(query, candidates, topK, includeReasoning)
      const response = await callLLM(prompt, includeReasoning)

      const result = parseRerankingResponse(response, includeReasoning)

      // Validate and map indices to actual results
      const reranked = result.selectedIndices
        .filter(idx => idx >= 0 && idx < candidates.length)
        .map(idx => candidates[idx])

      if (reranked.length === 0) {
        console.warn('[useReranking] No valid indices returned, falling back to original order')
        return candidates.slice(0, topK)
      }

      return reranked
    }
    catch (error) {
      console.error('[useReranking] Reranking failed, falling back to original order:', error)
      return candidates.slice(0, topK)
    }
  }

  /**
   * Build the reranking prompt
   */
  function buildRerankingPrompt(
    query: string,
    candidates: KnowledgeResult[],
    topK: number,
    includeReasoning: boolean,
  ): string {
    const candidateList = candidates
      .map((c, i) => {
        const preview = c.content.slice(0, 150).replace(/\n/g, ' ')
        return `${i}. ${preview}${c.content.length > 150 ? '...' : ''}`
      })
      .join('\n')

    return `元の質問: "${query}"

以下の候補の中から、質問に最も関連性の高いものを${topK}個選んでください。

候補:
${candidateList}

選択基準:
1. 質問の意図に直接答えられる具体的な内容
2. 質問のキーワードと直接関連する固有名詞や事実
3. 抽象的・間接的な関連は低優先度
4. "好き"などの汎用的な単語だけの一致は避ける

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
              description: 'Array of selected candidate indices',
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
              description: 'Array of selected candidate indices',
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
            name: 'reranking_result',
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
  function parseRerankingResponse(
    responseText: string,
    includeReasoning: boolean,
  ): RerankingResult {
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
      console.error('[useReranking] Failed to parse LLM response:', error)
      throw error
    }
  }

  return {
    rerankResults,
  }
}
