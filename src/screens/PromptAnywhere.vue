
<template>
  <div class="anywhere">
    <Prompt :enable-doc-repo="false" :enable-attachments="false" :enable-experts="true" :inline-experts="false" :enable-commands="false" />
  </div>
</template>

<script setup>

import { onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import Prompt from '../components/Prompt.vue'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// load store
store.loadSettings()
store.loadExperts()

const props = defineProps({
  extra: Object
})

onMounted(() => {
  onEvent('send-prompt', onPrompt)
  onEvent('prompt-resize', onResize)
  onEvent('show-experts', onExperts)
  window.api.on('set-expert-prompt', onSetExpertPrompt)
  document.addEventListener('keyup', onKeyUp)

  // auto-fill
  if (props.extra?.foremostApp) {
    const expert = store.experts.find((p) => p.triggerApps?.find((app) => app.identifier == props.extra.foremostApp))
    if (expert) {
      console.log(`Tiggered on ${props.extra.foremostApp}: filling prompt with expert ${expert.name}`)
      onSetExpertPrompt(expert.id)
    }
  }

})

onUnmounted(() => {
  document.removeEventListener('keyup', onKeyUp)
})

const onSetExpertPrompt = (id) => {
  const prompt = store.experts.find((p) => p.id == id)
  emitEvent('set-expert-prompt', prompt.prompt)
}

const onResize = (data) => {
  const height = parseInt(data) + 18
  window.api.anywhere.resize(height)
}

const onExperts = () => {
  if (!window.api.anywhere.isExpertsOpen()) {
    window.api.anywhere.showExperts()
  }
}

const onKeyUp = (event) => {
  if (event.key === 'Escape') {
    window.api.anywhere.cancel()
  }
}

const onPrompt = (data) => {
  window.api.anywhere.prompt(data)
}

</script>

<style scoped>

.anywhere {
  background-color: #e7e6e5;
}

</style>
