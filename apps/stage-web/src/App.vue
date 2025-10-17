<script setup lang="ts">
import { ToasterRoot } from '@proj-airi/stage-ui/components'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useModsChannelServerStore } from '@proj-airi/stage-ui/stores/mods/api/channel-server'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { StageTransitionGroup } from '@proj-airi/ui-transitions'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'

import LicenseNotice from './components/LicenseNotice.vue'

import { useIdleTalk } from './composables/idle-talk'
import { useKnowledgeDB } from './composables/useKnowledgeDB'
import { useKnowledgeDBIntegration } from './composables/useKnowledgeDBIntegration'
import { usePWAStore } from './stores/pwa'

import 'vue-sonner/style.css'

usePWAStore()
const i18n = useI18n()
const displayModelsStore = useDisplayModelsStore()
const settingsStore = useSettings()
const settings = storeToRefs(settingsStore)
const isDark = useDark()
const channelServerStore = useModsChannelServerStore()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const airiCardStore = useAiriCardStore()
const knowledgeDB = useKnowledgeDB()
const knowledgeDBIntegration = useKnowledgeDBIntegration()

const primaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${0})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${0})) 90%, oklch(90% 0 360))`
})

const secondaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${180})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${180})) 90%, oklch(90% 0 360))`
})

const tertiaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${60})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${60})) 90%, oklch(90% 0 360))`
})

const colors = computed(() => {
  return [primaryColor.value, secondaryColor.value, tertiaryColor.value, isDark.value ? '#121212' : '#FFFFFF']
})

watch(settings.language, () => {
  i18n.locale.value = settings.language.value
})

watch(settings.themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', settings.themeColorsHue.value.toString())
}, { immediate: true })

watch(settings.themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', settings.themeColorsHueDynamic.value)
}, { immediate: true })

// Initialize first-time setup check when app mounts
onMounted(async () => {
  // Load configuration from environment variables
  const llmProvider = import.meta.env.VITE_LLM_PROVIDER
  const llmApiKey = import.meta.env.VITE_LLM_API_KEY
  const llmBaseUrl = import.meta.env.VITE_LLM_BASE_URL
  const llmModel = import.meta.env.VITE_LLM_MODEL

  const ttsProvider = import.meta.env.VITE_TTS_PROVIDER
  const ttsApiKey = import.meta.env.VITE_TTS_API_KEY
  const ttsBaseUrl = import.meta.env.VITE_TTS_BASE_URL
  const ttsModel = import.meta.env.VITE_TTS_MODEL
  const ttsVoiceId = import.meta.env.VITE_TTS_VOICE_ID

  // Configure LLM provider if environment variables are set
  if (llmProvider && llmApiKey) {
    providersStore.providers[llmProvider] = {
      ...providersStore.providers[llmProvider],
      apiKey: llmApiKey,
      baseUrl: llmBaseUrl,
    }
    consciousnessStore.activeProvider = llmProvider
    consciousnessStore.activeModel = llmModel
  }

  // Configure TTS provider if environment variables are set
  if (ttsProvider && ttsApiKey) {
    providersStore.providers[ttsProvider] = {
      ...providersStore.providers[ttsProvider],
      apiKey: ttsApiKey,
      baseUrl: ttsBaseUrl,
    }
    speechStore.activeSpeechProvider = ttsProvider
    speechStore.activeSpeechModel = ttsModel

    // Set voice by adding it to availableVoices first
    if (ttsVoiceId) {
      const voiceObject = {
        id: ttsVoiceId,
        name: 'Environment Voice',
      }

      // Initialize availableVoices for this provider if needed
      if (!speechStore.availableVoices[ttsProvider]) {
        speechStore.availableVoices[ttsProvider] = []
      }

      // Add voice to availableVoices array so the watcher can find it
      speechStore.availableVoices[ttsProvider].push(voiceObject)

      // Now set the voice ID - the watcher will find it in availableVoices
      speechStore.activeSpeechVoiceId = ttsVoiceId
    }
  }

  // Configure character from environment variables
  const characterName = import.meta.env.VITE_CHARACTER_NAME
  const systemPromptPath = import.meta.env.VITE_CHARACTER_SYSTEM_PROMPT_PATH

  if (systemPromptPath) {
    try {
      const response = await fetch(systemPromptPath)
      if (response.ok) {
        const customSystemPrompt = await response.text()

        // Update the default card with custom system prompt
        const defaultCard = airiCardStore.getCard('default')
        if (defaultCard) {
          defaultCard.description = customSystemPrompt
          if (characterName) {
            defaultCard.name = characterName
          }
          console.info('[App.vue] Custom system prompt loaded from:', systemPromptPath)
        }
      }
      else {
        console.warn('[App.vue] Failed to load system prompt from:', systemPromptPath, response.statusText)
      }
    }
    catch (error) {
      console.error('[App.vue] Error loading system prompt:', error)
    }
  }

  // Setup knowledge DB integration
  // The actual hook will be registered by Stage.vue to avoid being cleared by clearHooks()
  if (knowledgeDB.config.enabled) {
    console.info('[App.vue] Knowledge DB integration enabled')

    // Store the original system prompt
    let baseSystemPrompt = ''
    const defaultCard = airiCardStore.getCard('default')
    if (defaultCard) {
      baseSystemPrompt = defaultCard.description
    }

    // Initialize the shared integration state
    // Stage.vue will use this state to inject knowledge
    knowledgeDBIntegration.initialize(baseSystemPrompt, knowledgeDB)
  }

  // Initialize idle talk feature if enabled
  const idleTalkEnabled = import.meta.env.VITE_IDLE_TALK_ENABLED === 'true'
  const idleTalkTimeout = Number(import.meta.env.VITE_IDLE_TIMEOUT || 60000)
  const idleTalkMode = import.meta.env.VITE_IDLE_TALK_MODE || 'random'
  const idleTalkMinSimilarity = Number(import.meta.env.VITE_IDLE_TALK_MIN_SIMILARITY || 0.0)

  if (idleTalkEnabled) {
    console.info('[App.vue] Initializing idle talk feature')

    const idleTalk = useIdleTalk({
      enabled: idleTalkEnabled,
      timeout: idleTalkTimeout,
      mode: idleTalkMode as 'random' | 'sequential',
      minSimilarity: idleTalkMinSimilarity,
    })

    idleTalk.initialize()
  }

  // Onboarding is disabled for OBS streaming usage
  // onboardingStore.initializeSetupCheck()
  channelServerStore.initialize()

  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  await settingsStore.initializeStageModel()
})

onUnmounted(() => {
  channelServerStore.dispose()
})
</script>

<template>
  <StageTransitionGroup
    :primary-color="primaryColor"
    :secondary-color="secondaryColor"
    :tertiary-color="tertiaryColor"
    :colors="colors"
    :z-index="100"
    :disable-transitions="settings.disableTransitions.value"
    :use-page-specific-transitions="settings.usePageSpecificTransitions.value"
  >
    <RouterView v-slot="{ Component }">
      <KeepAlive :include="['IndexScenePage', 'StageScenePage']">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </StageTransitionGroup>

  <ToasterRoot @close="id => toast.dismiss(id)">
    <Toaster />
  </ToasterRoot>

  <!-- First Time Setup Dialog -->
  <!-- Commented out for OBS streaming usage - onboarding not needed -->
  <!--
  <OnboardingDialog
    v-model="shouldShowSetup"
    @configured="handleSetupConfigured"
    @skipped="handleSetupSkipped"
  />
  -->

  <!-- License Notice -->
  <LicenseNotice />
</template>

<style>
/* We need this to properly animate the CSS variable */
@property --chromatic-hue {
  syntax: '<number>';
  initial-value: 0;
  inherits: true;
}

@keyframes hue-anim {
  from {
    --chromatic-hue: 0;
  }
  to {
    --chromatic-hue: 360;
  }
}

.dynamic-hue {
  animation: hue-anim 10s linear infinite;
}
</style>
