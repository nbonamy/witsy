<template>
  <div class="main-window">
    <header></header>
    <main>
      <WorkspaceBar v-if="store.isFeatureEnabled('workspaces')" />
      <MenuBar :mode="mode" @change="onMode" @new-chat="onNewChat" @run-onboarding="onRunOnboarding" />
      <Settings :style="{ display: mode === 'settings' ? undefined : 'none' }" :extra="viewParams" />
      <Chat ref="chat" :style="{ display: mode === 'chat' ? undefined : 'none' }" :extra="viewParams" />
      <DesignStudio :style="{ display: mode === 'studio' ? undefined : 'none' }" />
      <AgentForge v-if="mode === 'agents'" ref="agents" />
      <RealtimeChat v-if="mode === 'voice-mode'" ref="realtime" />
      <Transcribe v-if="mode === 'dictation'" ref="transcribe" />
    </main>
    <footer>
      <label>StationOne v0.0.1</label>
      <div class="actions">
        <ActivityIcon @click="onMode('debug')"/>
        <CommandIcon />
        <CircleQuestionMarkIcon />
      </div>
    </footer>
  </div>
  <Onboarding v-if="onboard" @close="onOnboardingDone" />
  <DocRepos v-if="docrepos" @close="onDocReposClose" />
  <Fullscreen window="main" />
</template>

<script setup lang="ts">

import { ActivityIcon, CircleQuestionMarkIcon, CommandIcon } from 'lucide-vue-next'
import { nextTick, onMounted, ref } from 'vue'
import Fullscreen from '../components/Fullscreen.vue'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import WorkspaceBar from '../components/WorkspaceBar.vue'
import AgentForge from '../screens/AgentForge.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import Onboarding from '../screens/Onboarding.vue'
import RealtimeChat from '../screens/RealtimeChat.vue'
import Settings from '../screens/Settings.vue'
import Transcribe from '../screens/Transcribe.vue'
import { store } from '../services/store'
import { anyDict } from '../types/index'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

const chat = ref<typeof Chat>(null)
const transcribe = ref<typeof Transcribe>(null)
const realtime = ref<typeof RealtimeChat>(null)
const onboard = ref(false)
const docrepos = ref(false)

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

  // internal messages
  onEvent('new-chat', () => onMode('chat'))
  onEvent('set-main-window-mode', (next: MenuBarMode) => {
    onMode(next)
  })

  // dictation
  window.api.on('start-dictation', onDictate)

  // show onboarding when window opens
  window.api.on('window-opened', () => {
    if (!store.config.general.onboardingDone) {
      setTimeout(() => onboard.value = true, 500)
    }
  })

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
  } else if (next === 'docrepo') {
    docrepos.value = true
  } else {
    mode.value = next
  }

  // notify those who care
  await nextTick()
  emitEvent('main-view-changed', next)

  // for menu update
  if (mode.value !== 'computer-use' && mode.value !== 'scratchpad' && mode.value !== 'debug') {
    window.api.main.updateMode(mode.value)
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

const onNewChat = () => {
  chat.value?.newChat()
  onMode('chat')
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

const onDocReposClose = () => {
  docrepos.value = false
}

</script>

<style>
@import 'sweetalert2/dist/sweetalert2.css';
@import '../../css/swal2.css';
</style>

<style scoped>

.main-window {

  display: flex;
  flex-direction: column;
  height: 100vh;

  header {
    -webkit-app-region: drag;
    flex: 0 0 var(--window-toolbar-height);
    border-bottom: 1px solid var(--border-color);
  }

  &:has(~ .fullscreen-drawer.visible) {
    header {
      -webkit-app-region: no-drag;
    }
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: row;
    max-height: calc(100vh - var(--window-toolbar-height) - 2.5rem);
  }

  footer {

    flex: 0 0 1rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border-color);

    display: flex;
    flex-direction: row;
    
    font-size: 10pt;
    color: var(--faded-text-color);

    .actions {
      margin-left: auto;
      display: flex;
      gap: 1rem;
      svg {
        cursor: pointer;
      }
    }



  }

}

</style>
