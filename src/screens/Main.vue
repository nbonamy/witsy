<template>
  <div class="main">
    <MenuBar :mode="mode" @change="onMode" @run-onboarding="onRunOnboarding" />
    <Settings :style="{ display: mode === 'settings' ? 'flex' : 'none' }" :extra="viewParams" />
    <Chat ref="chat" :style="{ display: mode === 'chat' ? 'flex' : 'none' }" :extra="viewParams" />
    <DesignStudio :style="{ display: mode === 'studio' ? 'flex' : 'none' }" />
    <DocRepos v-if="mode === 'docrepo'" />
    <AgentForge v-if="mode === 'agents'" ref="agents" />
    <RealtimeChat v-if="mode === 'voice-mode'" ref="realtime" />
    <Transcribe v-if="mode === 'dictation'" ref="transcribe" />
  </div>
  <Onboarding v-if="onboard" @close="onOnboardingDone" />
  <Fullscreen window="main" />
</template>

<script setup lang="ts">

import { anyDict } from '../types/index'
import { ref, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import AgentForge from '../screens/AgentForge.vue'
import Settings from '../screens/Settings.vue'
import RealtimeChat from '../screens/RealtimeChat.vue'
import Transcribe from '../screens/Transcribe.vue'
import Onboarding from '../screens/Onboarding.vue'
import Fullscreen from '../components/Fullscreen.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

const chat = ref<typeof Chat>(null)
const transcribe = ref<typeof Transcribe>(null)
const realtime = ref<typeof RealtimeChat>(null)
const onboard = ref(false)

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')
const viewParams = ref(null)

onMounted(() => {

  console.log('[main] mounted')

  // when close
  window.api.on('window-closed', () => {
    mode.value = 'none'
  })

  // init
  window.api.on('query-params', (params) => {
    processQueryParams(params)
  })
  if (props.extra) {
    processQueryParams(props.extra)
  }

  // new chat
  onEvent('new-chat', () => {
    onMode('chat')
  })

  // dictation
  window.api.on('start-dictation', onDictate)

  // show onboarding
  if (!store.config.general.onboardingDone) {
    onboard.value = true
  }

  // show it again
  window.api.on('run-onboarding', onRunOnboarding)

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
  } else if (next === 'debug') {
    window.api.debug.showConsole()
  } else {
    mode.value = next
  }

  // notify those who care
  await nextTick()
  emitEvent('main-view-changed', next)

  // for menu update
  if (mode.value !== 'computer-use' && mode.value !== 'scratchpad' && mode.value !== 'debug') {
    window.api.main.setMode(mode.value)
  }

}

const onDictate = () => {
  if (mode.value === 'chat') {
    chat.value?.startDictation()
  } else if (mode.value === 'dictation') {
    transcribe.value?.startDictation()
  } else if (mode.value === 'voice-mode') {
    realtime.value?.startDictation()
  }
}

const onRunOnboarding = () => {
  onboard.value = true
  store.config.general.onboardingDone = false
  store.saveSettings()
}

const onOnboardingDone = () => {
  onboard.value = false
  store.config.general.onboardingDone = true
  store.saveSettings()
}

</script>

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>
