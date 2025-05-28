<template>
  <div class="main">
    <MenuBar :mode="mode" @change="onMode"/>
    <Settings :style="{ display: mode === 'settings' ? 'flex' : 'none' }" :extra="viewParams" />
    <Chat :style="{ display: mode === 'chat' ? 'flex' : 'none' }" :extra="viewParams" />
    <DesignStudio :style="{ display: mode === 'studio' ? 'flex' : 'none' }" />
    <DocRepos :style="{ display: mode === 'docrepo' ? 'flex' : 'none' }" />
    <RealtimeChat :style="{ display: mode === 'voice-mode' ? 'flex' : 'none' }" />
    <Transcribe :style="{ display: mode === 'dictation' ? 'flex' : 'none' }" />
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
import RealtimeChat from '../screens/RealtimeChat.vue'
import Transcribe from '../screens/Transcribe.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')
const viewParams = ref(null)

onMounted(() => {

  console.log('[main] mounted')

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

  //console.log('[main] onMode', next)

  if (next === 'scratchpad') {
    window.api.scratchpad.open()
  } else if (next === 'computer-use') {
    mode.value = 'chat'
    await nextTick()
    emitEvent('activate-computer-use')
  } else if (next === 'debug') {
    window.api.debug.showConsole()
  } else {
    mode.value = next
  }

  // special
  if (mode.value === 'dictation') {
    emitEvent('start-dictation')
  } else {
    emitEvent('stop-dictation')
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
