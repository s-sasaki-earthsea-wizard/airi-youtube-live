<script setup lang="ts">
import { WidgetStage } from '@proj-airi/stage-ui/components/scenes'
import { useChatStore } from '@proj-airi/stage-ui/stores/chat'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { breakpointsTailwind, useBreakpoints, useDark, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'

import Cross from '../components/Backgrounds/Cross.vue'
import Header from '../components/Layouts/Header.vue'
import InteractiveArea from '../components/Layouts/InteractiveArea.vue'
import MobileHeader from '../components/Layouts/MobileHeader.vue'
import MobileInteractiveArea from '../components/Layouts/MobileInteractiveArea.vue'
import AnimatedWave from '../components/Widgets/AnimatedWave.vue'

import { isCurrentlyIdleTalking } from '../composables/idle-talk'
import { useStreamingMode } from '../composables/streaming-mode'
import { themeColorFromPropertyOf, useThemeColor } from '../composables/theme-color'
import { useKnowledgeDBIntegration } from '../composables/useKnowledgeDBIntegration'

const streamingMode = useStreamingMode()
const dark = useDark()
const paused = ref(false)

function handleSettingsOpen(open: boolean) {
  paused.value = open
}

const positionCursor = useMouse()
const { scale, position, positionInPercentageString } = storeToRefs(useLive2d())
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

const { updateThemeColor } = useThemeColor(themeColorFromPropertyOf('.widgets.top-widgets .colored-area', 'background-color'))
watch(dark, () => updateThemeColor(), { immediate: true })

const chatStore = useChatStore()
const airiCardStore = useAiriCardStore()
const knowledgeDBIntegration = useKnowledgeDBIntegration()

onMounted(() => {
  updateThemeColor()

  // Register knowledge DB hook with persistent flag
  // This hook will NOT be cleared by Stage.vue's clearHooks() call
  const integrationState = knowledgeDBIntegration.getState()
  if (integrationState.enabled && integrationState.knowledgeDB) {
    console.info('[index.vue] Registering persistent knowledge DB hook')

    chatStore.onBeforeMessageComposed(async (userMessage: string) => {
      console.info('[index.vue] Knowledge hook triggered for message:', userMessage)

      // Skip Knowledge DB query during idle talk
      if (isCurrentlyIdleTalking.value) {
        console.info('[index.vue] Skipping Knowledge DB query (idle talk in progress)')
        return
      }

      try {
        const { baseSystemPrompt, knowledgeDB } = integrationState

        // Query knowledge database for relevant information
        const knowledgeResponse = await knowledgeDB!.queryKnowledge(userMessage)

        if (knowledgeResponse && knowledgeResponse.results.length > 0) {
          // Format knowledge and inject into system prompt
          const knowledgeContext = knowledgeDB!.formatKnowledgeForPrompt(knowledgeResponse.results)

          // Update the system prompt with knowledge context
          const defaultCard = airiCardStore.getCard('default')
          if (defaultCard) {
            defaultCard.description = baseSystemPrompt + knowledgeContext
            console.info(`[index.vue] Injected ${knowledgeResponse.total} knowledge results into system prompt`)
          }
        }
        else {
          // Reset to base prompt if no relevant knowledge found
          const defaultCard = airiCardStore.getCard('default')
          if (defaultCard) {
            defaultCard.description = baseSystemPrompt
          }
          console.info('[index.vue] No relevant knowledge found, using base prompt')
        }
      }
      catch (error) {
        console.error('[index.vue] Failed to query knowledge DB:', error)
        // Continue with original system prompt on error
      }
    }, { persistent: true }) // Mark this hook as persistent

    console.info('[index.vue] Knowledge DB hook registered with persistent flag')
  }
})
</script>

<template>
  <Cross>
    <AnimatedWave
      class="widgets top-widgets"
      :fill-color="dark
        ? 'oklch(35% calc(var(--chromatic-chroma) * 0.6) var(--chromatic-hue))'
        : 'color-mix(in srgb, oklch(95% calc(var(--chromatic-chroma-50) * 0.5) var(--chromatic-hue)) 80%, oklch(100% 0 360))'"
    >
      <div relative flex="~ col" z-2 h-100dvh w-100vw of-hidden>
        <!-- header -->
        <div v-if="streamingMode.showHeader" class="px-0 py-1 md:px-3 md:py-3" w-full gap-2>
          <Header class="hidden md:flex" />
          <MobileHeader class="flex md:hidden" />
        </div>
        <!-- page -->
        <div
          relative flex="~ 1 row gap-y-0 gap-x-2 <md:col"
        >
          <WidgetStage
            flex-1 min-w="1/2"
            :paused="paused"
            :focus-at="{
              x: positionCursor.x.value,
              y: positionCursor.y.value,
            }"
            :x-offset="`${isMobile ? position.x : position.x - 10}%`"
            :y-offset="positionInPercentageString.y"
            :scale="scale"
          />
          <InteractiveArea
            v-if="!isMobile"
            :class="streamingMode.showHeader ? 'h-85dvh' : 'h-95dvh'"
            absolute right-4 flex flex-1 flex-col max-w="500px" min-w="30%"
          />
          <MobileInteractiveArea v-if="isMobile" @settings-open="handleSettingsOpen" />
        </div>
      </div>
    </AnimatedWave>
  </Cross>
</template>

<route lang="yaml">
name: IndexScenePage
meta:
  layout: stage
  stageTransition:
    name: bubble-wave-out
</route>
