<script setup lang="ts">
// License notice component for attribution
</script>

<template>
  <div class="license-notice">
    <p class="powered-by">
      Powered by AIRI
    </p>
    <p class="github-url">
      https://github.com/moeru-ai/airi
    </p>
  </div>
</template>

<style scoped>
.license-notice {
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.75);
  color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  line-height: 1.5;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.powered-by {
  margin: 0 0 2px 0;
  font-weight: 500;
}

.github-url {
  margin: 0;
  color: #58a6ff;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 15px;
}

/* Responsive: smaller on narrow screens */
@media (max-width: 768px) {
  .license-notice {
    font-size: 10px;
    padding: 6px 10px;
    bottom: 8px;
    right: 8px;
  }

  .github-url {
    font-size: 9px;
  }
}
</style>
