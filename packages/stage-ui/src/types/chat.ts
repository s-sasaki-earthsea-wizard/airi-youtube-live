import type { AssistantMessage, CommonContentPart, CompletionToolCall, SystemMessage, ToolMessage, UserMessage } from '@xsai/shared-chat'

export interface ChatSlicesText {
  type: 'text'
  text: string
}

export interface ChatSlicesToolCall {
  type: 'tool-call'
  toolCall: CompletionToolCall
}

export interface ChatSlicesToolCallResult {
  type: 'tool-call-result'
  id: string
  result?: string | CommonContentPart[]
}

export type ChatSlices = ChatSlicesText | ChatSlicesToolCall | ChatSlicesToolCallResult

export interface ChatAssistantMessage extends AssistantMessage {
  slices: ChatSlices[]
  tool_results: {
    id: string
    result?: string | CommonContentPart[]
  }[]
}

/**
 * Extended user message with optional author information
 * Used for displaying YouTube usernames or other external user identifiers
 */
export interface ChatUserMessage extends UserMessage {
  author?: string
  source?: string
}

export type ChatMessage = ChatAssistantMessage | SystemMessage | ToolMessage | ChatUserMessage
