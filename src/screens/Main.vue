<template>
  <div class="main-window window">
    <header></header>
    <main>
      <WorkspaceBar v-if="store.isFeatureEnabled('workspaces')" />
      <MenuBar :mode="modeForMenuBar" @change="onMode" @new-chat="onNewChat" @run-onboarding="onRunOnboarding" />
      <Chat ref="chat" :style="{ display: mode === 'chat' ? undefined : 'none' }" :extra="viewParams" />
      <DesignStudio :style="{ display: mode === 'studio' ? undefined : 'none' }" />
      <RealtimeChat v-if="mode === 'voice-mode'" ref="realtime" />
      <Transcribe v-if="mode === 'dictation'" ref="transcribe" />
    </main>
    <footer>
      <label>{{ t('common.appName') }} v{{ version }}</label>
      <div class="actions">
        <ActivityIcon @click="onMode('debug')"/>
        <!-- <CommandIcon />
        <CircleQuestionMarkIcon /> -->
      </div>
    </footer>
  </div>
  <Settings :style="{ display: fullScreenPanel == 'settings' ? undefined : 'none' }" :extra="viewParams" @closed="onCloseFullScreenPanel" ref="settings" />
  <Onboarding v-if="showOnboarding" @close="onOnboardingDone" />
  <AgentForge v-if="fullScreenPanel === 'agents'" @closed="onCloseFullScreenPanel" />
  <McpServers v-if="fullScreenPanel == 'mcp'" @closed="onCloseFullScreenPanel" />
  <DocRepos v-if="fullScreenPanel == 'docrepos'" @closed="onCloseFullScreenPanel" />
  <Fullscreen window="main" />
</template>

<script setup lang="ts">

import { ActivityIcon } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref } from 'vue'
import Fullscreen from '../components/Fullscreen.vue'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import WorkspaceBar from '../components/WorkspaceBar.vue'
import useEventBus from '../composables/event_bus'
import AgentForge from '../screens/AgentForge.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import McpServers from '../screens/McpServers.vue'
import Onboarding from '../screens/Onboarding.vue'
import RealtimeChat from '../screens/RealtimeChat.vue'
import Settings from '../screens/Settings.vue'
import Transcribe from '../screens/Transcribe.vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { anyDict } from '../types/index'

const { emitEvent, onEvent } = useEventBus()

const chat = ref<typeof Chat>(null)
const transcribe = ref<typeof Transcribe>(null)
const realtime = ref<typeof RealtimeChat>(null)
const settings = ref<typeof Settings>(null)
const showOnboarding = ref(false)

type FullScreenPanel = 'none' | 'settings' | 'docrepos' | 'mcp' | 'agents'
const fullScreenPanel = ref<FullScreenPanel>('none')

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')
const viewParams = ref(null)

const version = computed(() => {
  return window.api.app.getVersion()
})

const modeForMenuBar = computed(() => {
  if (fullScreenPanel.value !== 'none') {
    return fullScreenPanel.value
  }
  return mode.value
})

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
      setTimeout(() => showOnboarding.value = true, 500)
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
    if (params.view === 'docrepos') {
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
  } else if (next === 'docrepos') {
    fullScreenPanel.value = 'docrepos'
  } else if (next === 'mcp') {
    fullScreenPanel.value = 'mcp'
  } else if (next === 'settings') {
    fullScreenPanel.value = 'settings'
    settings.value.show()
  } else if (next === 'agents') {
    fullScreenPanel.value = 'agents'
  } else {
    fullScreenPanel.value = 'none'
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
  showOnboarding.value = true
  store.config.general.onboardingDone = false
  store.saveSettings()
}

const onOnboardingDone = () => {
  showOnboarding.value = false
  store.config.general.onboardingDone = true
  store.saveSettings()
}

const onCloseFullScreenPanel = () => {
  fullScreenPanel.value = 'none'
}

</script>

<style>
@import 'sweetalert2/dist/sweetalert2.css';
@import '../../css/swal2.css';
</style>

<style>

/* hack! */
.main-window:has(~ .fullscreen-drawer.visible) {
  main .settings * {
    z-index: -1 !important;
  }
}

</style>