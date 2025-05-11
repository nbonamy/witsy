<template>
  <div class="main">
    <MenuBar :mode="mode" @change="onMode"/>
    <Chat v-if="mode === 'chat'"/>
    <DesignStudio v-if="mode === 'studio'"/>
    <DocRepos v-if="mode === 'docrepo'"/>
    <Settings v-if="mode === 'settings'"/>
  </div>
</template>

<script setup lang="ts">

import { ref, nextTick } from 'vue'
import { store } from '../services/store'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import Settings from '../screens/Settings.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')

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

