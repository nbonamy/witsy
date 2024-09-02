
<template>
  <div class="anywhere-experts">
    <ContextMenu :teleport="false" :show-filter="true" :actions="experts" @action-clicked="handleExpertClick" :x="0" :y="0" align="bottom" />
  </div>
</template>

<script setup>

import { computed, onMounted, onUnmounted } from 'vue'
import ContextMenu from '../components/ContextMenu.vue'
import { store } from '../services/store'
import { BIconStars } from 'bootstrap-icons-vue'

// load store
store.loadExperts()

const experts = computed(() => {
  return store.experts.filter(p => p.state == 'enabled').map(p => {
    return { label: p.name, action: p.name, icon: BIconStars }
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
    window.api.anywhere.closeExperts()
  }
}

const handleExpertClick = (action) => {
  const expert = store.experts.find(p => p.name === action)
  window.api.anywhere.onExpert(expert.id)
}

</script>

<style>

.anywhere-expert .context-menu {
  min-width: calc(100% - 10px);
  min-height: calc(100% - 10px);
}

</style>
