import type { LLMConfig } from './config'

import OpenAI from 'openai'

/**
 * LLM client for generating commentary
 */
export class LLMClient {
  private client: OpenAI

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
  }

  /**
   * Generate text completion using LLM
   * @param prompt - The prompt to send to the LLM
   * @param model - The model to use
   * @returns Generated text
   */
  async generateText(prompt: string, model: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      return content.trim()
    }
    catch (error) {
      throw new Error(`LLM API error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate streaming text completion using LLM
   * @param prompt - The prompt to send to the LLM
   * @param model - The model to use
   * @param onChunk - Callback for each chunk of text
   */
  async generateTextStream(
    prompt: string,
    model: string,
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          onChunk(content)
        }
      }
    }
    catch (error) {
      throw new Error(`LLM API error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
