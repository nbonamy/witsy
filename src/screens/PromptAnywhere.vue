
<template>
  <div class="anywhere">
    <Prompt :enable-attachments="false" :enable-custom-prompts="false" :enable-commands="false" />
  </div>
</template>

<script setup>

import { onMounted, onUnmounted } from 'vue'
import Prompt from '../components/Prompt.vue'

import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

onMounted(() => {
  onEvent('sendPrompt', onPrompt)
  onEvent('promptResize', onResize)
  document.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  document.removeEventListener('keyup', onKeyUp)
})

const onResize = (data) => {
  const height = parseInt(data) + 18
  window.api.anywhere.resize(height)
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
