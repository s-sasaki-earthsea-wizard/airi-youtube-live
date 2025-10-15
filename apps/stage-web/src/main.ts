import type { Plugin } from 'vue'
import type { Router } from 'vue-router'

import Tres from '@tresjs/core'
import NProgress from 'nprogress'

import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { MotionPlugin } from '@vueuse/motion'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'

import { useWebSocketClient } from './composables/websocket-client'
import { i18n } from './modules/i18n'

import '@proj-airi/font-cjkfonts-allseto/index.css'
import '@proj-airi/font-xiaolai/index.css'
import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const pinia = createPinia()
const routeRecords = setupLayouts(routes)

let router: Router
if (import.meta.env.VITE_APP_TARGET_HUGGINGFACE_SPACE)
  router = createRouter({ routes: routeRecords, history: createWebHashHistory() })
else
  router = createRouter({ routes: routeRecords, history: createWebHistory() })

router.beforeEach((to, from) => {
  if (to.path !== from.path)
    NProgress.start()
})

router.afterEach(() => {
  NProgress.done()
})

const app = createApp(App)

app
  .use(MotionPlugin)
  // TODO: Fix autoAnimatePlugin type error
  .use(autoAnimatePlugin as unknown as Plugin)
  .use(router)
  .use(pinia)
  .use(i18n)
  .use(Tres)

// Initialize WebSocket client after Pinia stores are initialized
let airiWebSocketClient: ReturnType<typeof useWebSocketClient> | null = null

router.isReady().then(() => {
  try {
    console.info('[AIRI] Initializing WebSocket client...')
    airiWebSocketClient = useWebSocketClient()
    console.info('[AIRI] WebSocket client initialized')
    console.info('[AIRI] WebSocket client instance:', airiWebSocketClient)
  }
  catch (error) {
    console.error('[AIRI] Failed to initialize WebSocket client:', error)
  }
}).catch((error) => {
  console.error('[AIRI] Router not ready:', error)
})

app.mount('#app')
