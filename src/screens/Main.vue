<template>
  <div class="main">
    <MenuBar :mode="mode" @change="onMode"/>
    <Settings :style="{ display: mode === 'settings' ? 'flex' : 'none' }" :extra="viewParams" />
    <Chat :style="{ display: mode === 'chat' ? 'flex' : 'none' }" :extra="viewParams" />
    <DesignStudio :style="{ display: mode === 'studio' ? 'flex' : 'none' }" />
    <DocRepos :style="{ display: mode === 'docrepo' ? 'flex' : 'none' }" />
  </div>
</template>

<script setup lang="ts">

import { anyDict } from '../types/index'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { store } from '../services/store'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import Settings from '../screens/Settings.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')
const viewParams = ref(null)

onMounted(() => {

  // init
  window.api.on('query-params', (params) => {
    processQueryParams(params)
  })
  if (props.extra) {
    processQueryParams(props.extra)
  }

})

onUnmounted(() => {
  window.api.off('query-params')
})

const processQueryParams = (params: anyDict) => {
  console.log('[main] processing query params', JSON.stringify(params))
  if (params.view) {

    // switch and save params
    onMode(params.view)
    viewParams.value = params 

    // special
    if (params.view === 'docrepo') {
      emitEvent('create-docrepo')
    }

  }
}

const onMode = async (next: MenuBarMode) => {

  if (next === 'scratchpad') {
    window.api.scratchpad.open()
  } else if (next === 'dictation') {
    window.api.transcribe.start()
  } else if (next === 'voice-mode') {
    window.api.voiceMode.start()
  } else if (next === 'computer-use') {
    mode.value = 'chat'
    await nextTick()
    emitEvent('activate-computer-use')
  } else if (next === 'debug') {
    window.api.debug.showConsole()
  } else {
    mode.value = next
  }

}

</script>

<style scoped>

.main {
  
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

