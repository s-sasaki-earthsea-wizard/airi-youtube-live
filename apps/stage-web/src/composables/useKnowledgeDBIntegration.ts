/**
 * Knowledge Database Integration State
 *
 * Provides shared state for knowledge DB integration across components.
 * This is used by Stage.vue to inject knowledge into system prompts.
 */

import type { useKnowledgeDB } from './useKnowledgeDB'

import { ref } from 'vue'

interface KnowledgeDBIntegrationState {
  enabled: boolean
  baseSystemPrompt: string
  knowledgeDB: ReturnType<typeof useKnowledgeDB> | null
}

// Global state shared across the app
const integrationState = ref<KnowledgeDBIntegrationState>({
  enabled: false,
  baseSystemPrompt: '',
  knowledgeDB: null,
})

export function useKnowledgeDBIntegration() {
  /**
   * Initialize knowledge DB integration
   * Called by App.vue during onMounted
   */
  function initialize(
    baseSystemPrompt: string,
    knowledgeDB: ReturnType<typeof useKnowledgeDB>,
  ) {
    integrationState.value = {
      enabled: true,
      baseSystemPrompt,
      knowledgeDB,
    }
    console.info('[KnowledgeDBIntegration] Initialized with base prompt length:', baseSystemPrompt.length)
  }

  /**
   * Get the current integration state
   */
  function getState() {
    return integrationState.value
  }

  return {
    initialize,
    getState,
  }
}
