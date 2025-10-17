<script setup lang="ts">
import { useDark } from '@vueuse/core'

const isDark = useDark()
</script>

<template>
  <div class="license-notice">
    <img
      v-if="isDark"
      src="/src/assets/logo-dark.svg"
      alt="AIRI Logo"
      class="logo"
    >
    <img
      v-else
      src="/src/assets/logo.svg"
      alt="AIRI Logo"
      class="logo"
    >
    <div class="text-content">
      <p class="powered-by">
        Powered by AIRI
      </p>
      <p class="github-url">
        https://github.com/moeru-ai/airi
      </p>
    </div>
  </div>
</template>

<style scoped>
.license-notice {
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(59, 130, 246, 0.25);
  color: rgba(255, 255, 255, 0.95);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 18px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  line-height: 1.5;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 12px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5),
               0 2px 6px rgba(0, 0, 0, 0.3);
}

.logo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.text-content {
  display: flex;
  flex-direction: column;
}

.powered-by {
  margin: 0 0 2px 0;
  font-weight: 500;
}

.github-url {
  margin: 0;
  color: rgba(251, 253, 255, 0.9);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 15px;
}

/* Responsive: smaller on narrow screens */
@media (max-width: 768px) {
  .license-notice {
    font-size: 10px;
    padding: 6px 10px;
    bottom: 8px;
    left: 8px;
    gap: 8px;
  }

  .logo {
    width: 20px;
    height: 20px;
  }

  .github-url {
    font-size: 9px;
  }
}
</style>
