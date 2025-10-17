/**
 * Streaming Mode Composable
 *
 * Provides configuration for YouTube streaming mode.
 * Controls UI elements visibility for optimal streaming experience.
 */

export interface StreamingModeConfig {
  /**
   * Enable streaming mode (convenience flag that enables all streaming optimizations)
   */
  isStreamingMode: boolean

  /**
   * Show/hide header with logo and settings button
   */
  showHeader: boolean

  /**
   * Show/hide LLM responses in chat history
   * User messages will always be visible
   */
  showLLMResponses: boolean

  /**
   * Show/hide text input area
   * During streaming, messages come from YouTube chat so local input is unnecessary
   */
  showTextInput: boolean
}

/**
 * Get streaming mode configuration from environment variables
 */
export function useStreamingMode(): StreamingModeConfig {
  const streamingMode = import.meta.env.VITE_STREAMING_MODE === 'true'

  return {
    isStreamingMode: streamingMode,
    // When streaming mode is enabled, default to hiding header, LLM responses, and text input
    // But allow individual overrides via specific env vars
    showHeader: streamingMode
      ? import.meta.env.VITE_SHOW_HEADER === 'true'
      : import.meta.env.VITE_SHOW_HEADER !== 'false',
    showLLMResponses: streamingMode
      ? import.meta.env.VITE_SHOW_LLM_RESPONSES === 'true'
      : import.meta.env.VITE_SHOW_LLM_RESPONSES !== 'false',
    showTextInput: streamingMode
      ? import.meta.env.VITE_SHOW_TEXT_INPUT === 'true'
      : import.meta.env.VITE_SHOW_TEXT_INPUT !== 'false',
  }
}
