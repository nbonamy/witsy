<template>
  <div class="computer">
    <img ref="logo" class="logo" />
    <div class="state">{{ state || t('computerUse.state.idle') }}</div>
    <CircleXIcon class="stop" @click="onStop()" />
  </div>
</template>

<script setup lang="ts">

import useIpcListener from '@composables/ipc_listener'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { CircleXIcon } from 'lucide-vue-next'
import { LlmChunk } from 'multi-llm-ts'
import { onMounted, ref } from 'vue'

const { onIpcEvent } = useIpcListener()

// init stuff
store.loadSettings()

const logo = ref(null)
const state = ref('')

onMounted(() => {
  logo.value.src = document.querySelector<HTMLImageElement>('#logo').src
  onIpcEvent('computer-status', onComputerStatus)
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
  font-size: 14.5px;
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
    font-size: 16px;

    &:hover {
      color: var(--text-color);
    }
  }
}

</style>