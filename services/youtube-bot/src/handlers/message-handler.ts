import type { Client as AiriClient } from '@proj-airi/server-sdk'

import type { YouTubeLiveChatMessage } from '../types'

import { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from 'node:process'

import { useLogg } from '@guiiai/logg'
import { createOpenAI } from '@xsai-ext/providers-cloud'
import { generateSpeech } from '@xsai/generate-speech'
import { generateText } from '@xsai/generate-text'
import { message } from '@xsai/utils-chat'

const log = useLogg('MessageHandler').useGlobalConfig()

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class MessageHandler {
  private conversationHistory: ConversationMessage[] = []
  private readonly maxHistoryLength = 20
  private readonly audioOutputDir: string
  private llmProvider: any
  private ttsProvider: any
  private airiClient: AiriClient

  constructor(airiClient: AiriClient) {
    this.airiClient = airiClient
    this.audioOutputDir = env.AUDIO_OUTPUT_DIR || './audio-output'
    this.initializeProviders()
  }

  private initializeProviders() {
    // LLM プロバイダーの初期化
    if (!env.LLM_API_KEY) {
      log.warn('LLM_API_KEYが設定されていません。応答生成は無効です。')
    }
    else {
      this.llmProvider = createOpenAI(
        env.LLM_API_KEY,
        env.LLM_API_BASE_URL || 'https://api.openai.com/v1/',
      )
      log.log('LLMプロバイダーを初期化しました')
    }

    // TTS プロバイダーの初期化
    if (!env.TTS_API_KEY) {
      log.warn('TTS_API_KEYが設定されていません。音声生成は無効です。')
    }
    else {
      this.ttsProvider = createOpenAI(
        env.TTS_API_KEY,
        env.TTS_API_BASE_URL || 'https://api.openai.com/v1/',
      )
      log.log('TTSプロバイダーを初期化しました')
    }
  }

  async handleMessage(chatMessage: YouTubeLiveChatMessage): Promise<void> {
    log
      .withField('author', chatMessage.authorName)
      .withField('message', chatMessage.message)
      .log('メッセージを処理中...')

    try {
      // YouTube コメントを stage-web に送信（チャット表示用）
      await this.airiClient.send({
        type: 'input:text',
        data: {
          text: chatMessage.message,
          author: chatMessage.authorName,
          source: 'youtube',
          timestamp: chatMessage.timestamp,
        },
      })

      // LLMで応答を生成
      const responseText = await this.generateResponse(chatMessage)
      if (!responseText) {
        log.warn('応答テキストが生成されませんでした')
        return
      }

      log
        .withField('response', responseText)
        .log('応答を生成しました')

      // TTSで音声を生成
      const audioFilename = await this.generateAudio(responseText, chatMessage.id)

      // AI応答を stage-web に送信（チャット表示 + 音声再生用）
      await this.airiClient.send({
        type: 'output:text',
        data: {
          text: responseText,
          author: 'AIRI',
          source: 'youtube-bot',
        },
      })

      // 音声ファイル情報を送信
      if (audioFilename) {
        await this.airiClient.send({
          type: 'output:audio',
          data: {
            audioUrl: `http://localhost:3000/audio/${audioFilename}`,
            text: responseText,
          },
        })
      }
    }
    catch (error) {
      log.withError(error).error('メッセージ処理中にエラーが発生しました')
    }
  }

  private async generateResponse(chatMessage: YouTubeLiveChatMessage): Promise<string | null> {
    if (!this.llmProvider) {
      log.warn('LLMプロバイダーが初期化されていません')
      return null
    }

    // ユーザーメッセージを履歴に追加
    const userMessage: ConversationMessage = {
      role: 'user',
      content: `${chatMessage.authorName}: ${chatMessage.message}`,
    }
    this.conversationHistory.push(userMessage)

    // 履歴が長すぎる場合は古いものを削除（システムメッセージは保持）
    if (this.conversationHistory.length > this.maxHistoryLength) {
      const systemMessages = this.conversationHistory.filter(m => m.role === 'system')
      const recentMessages = this.conversationHistory
        .filter(m => m.role !== 'system')
        .slice(-this.maxHistoryLength)
      this.conversationHistory = [...systemMessages, ...recentMessages]
    }

    // システムプロンプトを準備
    const systemPrompt: ConversationMessage = {
      role: 'system',
      content: `あなたはYouTubeライブ配信でコメントに応答するAIアシスタントです。
視聴者のコメントに対して、親しみやすく、簡潔に応答してください。
応答は150文字以内に収めてください。`,
    }

    // メッセージ履歴を準備
    const messages = [systemPrompt, ...this.conversationHistory]

    try {
      const result = await generateText({
        ...this.llmProvider.chat(env.LLM_MODEL || 'gpt-4o-mini'),
        messages: messages.map(m => message[m.role](m.content)),
        maxTokens: 200,
      })

      const responseText = result.text.trim()

      // アシスタントの応答を履歴に追加
      this.conversationHistory.push({
        role: 'assistant',
        content: responseText,
      })

      return responseText
    }
    catch (error) {
      log.withError(error).error('LLM応答生成中にエラーが発生しました')
      return null
    }
  }

  private async generateAudio(text: string, messageId: string): Promise<string | null> {
    if (!this.ttsProvider) {
      log.warn('TTSプロバイダーが初期化されていません')
      return null
    }

    try {
      // 出力ディレクトリを作成
      await mkdir(this.audioOutputDir, { recursive: true })

      // タイムスタンプ付きのファイル名を生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `response_${timestamp}_${messageId}.mp3`
      const filepath = join(this.audioOutputDir, filename)

      log
        .withField('filepath', filepath)
        .log('音声ファイルを生成中...')

      // TTSで音声を生成
      const result = await generateSpeech({
        ...this.ttsProvider.speech(env.TTS_MODEL || 'tts-1'),
        input: text,
        voice: env.TTS_VOICE || 'alloy',
      })

      // ストリームをファイルに書き込み
      const writeStream = createWriteStream(filepath)
      const reader = result.audioStream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        writeStream.write(Buffer.from(value))
      }

      writeStream.end()

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      log
        .withField('filepath', filepath)
        .log('音声ファイルを生成しました')

      return filename
    }
    catch (error) {
      log.withError(error).error('音声生成中にエラーが発生しました')
      return null
    }
  }

  // 会話履歴をクリア
  clearHistory(): void {
    this.conversationHistory = []
    log.log('会話履歴をクリアしました')
  }
}
