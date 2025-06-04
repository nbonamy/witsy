<template>
  <div class="computer">
    <img ref="logo" class="logo" />
    <div class="state">{{ state || t('computerUse.state.idle') }}</div>
    <BIconXCircle class="stop" @click="onStop()" />
  </div>
</template>

<script setup lang="ts">

import { LlmChunk } from 'multi-llm-ts'
import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

// init stuff
store.loadSettings()

const logo = ref(null)
const state = ref('')

onMounted(() => {
  logo.value.src = document.querySelector<HTMLImageElement>('#logo').src
  window.api.on('computer-status', onComputerStatus)
})

onUnmounted(() => {
  window.api.off('computer-status', onComputerStatus)
})

const onComputerStatus = (chunk: LlmChunk) => {
  if (chunk.type === 'tool' && chunk.name === 'computer') {
    state.value = t(`computerUse.action.${chunk.call.params.action}`)
  } else {
    state.value = t('computerUse.state.working')
  }
}

const onStop = () => {
  window.api.computer.stop()
}

</script>

<style scoped>

.computer {
  
  height: 100vh;
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--window-bg-color);
  color: var(--text-color);
  font-size: 11pt;
  padding: 0px 16px;
  -webkit-app-region: drag;
  gap: 16px;

  .logo {
    width: 32px;
    height: 32px;
  }

  .state {
    height: 2.5em;
    overflow-y: auto; 
    white-space: pre-wrap;
    display: flex;
    justify-content: center;
    flex-direction: column-reverse;
  }

  .state::-webkit-scrollbar {
    display: none;
  }

  .stop {
    flex: 0 0 20px;
    -webkit-app-region: no-drag;
    color: var(--icon-color);
    cursor: pointer;
    margin-left: auto;
    font-size: 12pt;

    &:hover {
      color: var(--text-color);
    }
  }
}

</style>