import type { Logg } from '@guiiai/logg'
import type { ChatProvider } from '@xsai-ext/providers-cloud'

import type { BotConfig, YouTubeLiveChatMessage } from '../types'

import fs from 'node:fs/promises'
import path from 'node:path'

import { Buffer } from 'node:buffer'

import { generateSpeech } from '@xsai/generate-speech'
import { generateText } from '@xsai/generate-text'
import { message } from '@xsai/shared-chat'

export class MessageHandler {
  private config: BotConfig
  private logger: Logg
  private chatProvider: ChatProvider
  private conversationHistory: any[] = []
  private readonly MAX_HISTORY = 20

  constructor(config: BotConfig, chatProvider: ChatProvider, logger: Logg) {
    this.config = config
    this.chatProvider = chatProvider
    this.logger = logger
  }

  /**
   * Handle incoming YouTube Live Chat message
   */
  async handleMessage(msg: YouTubeLiveChatMessage): Promise<void> {
    try {
      this.logger
        .withField('author', msg.authorName)
        .withField('message', msg.message)
        .withField('type', msg.type)
        .log('Processing message')

      // Add special handling for Super Chats
      if (msg.type === 'super_chat' && msg.superChatDetails) {
        const amount = Number.parseInt(msg.superChatDetails.amountMicros, 10) / 1_000_000
        this.logger
          .withField('amount', amount)
          .withField('currency', msg.superChatDetails.currency)
          .log('Received Super Chat')
      }

      // Generate AI response
      const response = await this.generateResponse(msg)

      if (!response) {
        this.logger.warn('No response generated')
        return
      }

      this.logger.withField('response', response).log('Generated AI response')

      // Generate TTS audio
      await this.generateAudio(response, msg.id)

      this.logger.log('Message processing complete')
    }
    catch (error) {
      this.logger
        .withError(error as Error)
        .error('Error handling message')
    }
  }

  /**
   * Generate AI response using LLM
   */
  private async generateResponse(msg: YouTubeLiveChatMessage): Promise<string> {
    // Build conversation context
    const userMessage = msg.type === 'super_chat'
      ? `[SUPER CHAT ${msg.superChatDetails?.currency} ${Number.parseInt(msg.superChatDetails?.amountMicros || '0', 10) / 1_000_000}] ${msg.authorName}: ${msg.message}`
      : `${msg.authorName}: ${msg.message}`

    // Add to conversation history
    this.conversationHistory.push(message.user(userMessage))

    // Keep only recent messages
    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY)
    }

    // Add system message for context
    const messages = [
      message.system(
        'You are AIRI, a friendly AI VTuber streaming on YouTube. '
        + 'Respond naturally to chat messages. Keep responses concise (1-2 sentences). '
        + 'Be energetic and engaging. When you receive a Super Chat, express gratitude warmly.',
      ),
      ...this.conversationHistory,
    ]

    // Generate response
    const result = await generateText({
      ...this.chatProvider.chat(this.config.llm.model, {
        apiKey: this.config.llm.apiKey,
      }),
      messages,
    })

    const responseText = result.text.trim()

    // Add assistant response to history
    this.conversationHistory.push(message.assistant(responseText))

    return responseText
  }

  /**
   * Generate TTS audio from text
   */
  private async generateAudio(text: string, messageId: string): Promise<void> {
    try {
      // Import speech provider dynamically based on config
      const { openAIAudioSpeech } = await import('@xsai-ext/providers-cloud')

      const speechProvider = openAIAudioSpeech()

      const audioBuffer = await generateSpeech({
        ...speechProvider.speech(this.config.tts.model, {
          apiKey: this.config.tts.apiKey,
        }),
        input: text,
        voice: this.config.tts.voice,
      })

      // Save audio file
      const outputDir = this.config.outputDir
      await fs.mkdir(outputDir, { recursive: true })

      const filename = `${Date.now()}-${messageId}.mp3`
      const filepath = path.join(outputDir, filename)

      await fs.writeFile(filepath, Buffer.from(audioBuffer))

      this.logger.withField('filepath', filepath).log('Audio file saved')
    }
    catch (error) {
      this.logger
        .withError(error as Error)
        .error('Error generating audio')
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
    this.logger.log('Conversation history cleared')
  }
}
