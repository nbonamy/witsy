
<template>
  <div class="anywhere-custom-prompt">
    <ContextMenu :teleport="false" :show-filter="true" :actions="customPrompts" @action-clicked="handleCustomPromptClick" :x="0" :y="0" align="bottom" />
  </div>
</template>

<script setup>

import { computed, onMounted, onUnmounted } from 'vue'
import ContextMenu from '../components/ContextMenu.vue'
import { store } from '../services/store'
import { BIconStars } from 'bootstrap-icons-vue'

// load store
store.loadPrompts()

const customPrompts = computed(() => {
  return store.prompts.map(p => {
    return { label: p.actor, action: p.actor, icon: BIconStars }
  })
})

onMounted(() => {
  document.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  document.removeEventListener('keyup', onKeyUp)
})

const onKeyUp = (event) => {
  if (event.key === 'Escape') {
    window.api.anywhere.closeCustom()
  }
}

const handleCustomPromptClick = (action) => {
  const customPrompt = store.prompts.find(p => p.actor === action)
  window.api.anywhere.onCustom(customPrompt.prompt)
}

</script>

<style>

.anywhere-custom-prompt .context-menu {
  min-width: calc(100% - 10px);
  min-height: calc(100% - 10px);
}

</style>
