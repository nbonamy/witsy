<template>
  <div class="main-window window">

    <header />

    <main>
      
      <MenuBar :mode="mode" @change="onMode" @new-chat="onNewChat" @run-onboarding="onRunOnboarding" />
      
      <Chat ref="chat" :style="{ display: mode === 'chat' ? undefined : 'none' }" :extra="viewParams" />
      <DesignStudio :style="{ display: mode === 'studio' ? undefined : 'none' }" />
      <RealtimeChat v-if="mode === 'voice-mode'" ref="realtime" />
      <Transcribe v-if="mode === 'dictation'" ref="transcribe" />
    
      <AgentForge v-if="mode === 'agents'" />
      <McpServers v-if="mode === 'mcp'" />
      <DocRepos v-if="mode === 'docrepos'" />

      <!-- WebApp viewers - lazy loaded and kept mounted for session persistence -->
      <WebAppViewer
        v-for="webapp in loadedWebapps"
        :key="webapp.id"
        :webapp="webapp"
        :visible="mode === `webapp-${webapp.id}`"
        @update-last-used="updateLastUsed(webapp.id)"
        @navigate="onNavigate(webapp.id, $event)"
      />

      <ScratchPad :style="{
        display: mode === 'scratchpad' ? undefined : 'none',
        pointerEvents: mode == 'scratchpad' ? undefined : 'none'
      }" :extra="viewParams" ref="scratchpad" />

      <Settings :style="{
        display: mode === 'settings' ? undefined : 'none',
        pointerEvents: mode == 'settings' ? undefined : 'none'
      }" :extra="viewParams" ref="settings" />

      <Onboarding v-if="showOnboarding" @close="onOnboardingDone" />
    
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
  <Fullscreen window="main" />
</template>

<script setup lang="ts">

import { ActivityIcon } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Fullscreen from '../components/Fullscreen.vue'
import MenuBar, { MenuBarMode } from '../components/MenuBar.vue'
import useEventBus from '../composables/event_bus'
import useWebappManager from '../composables/webapp_manager'
import AgentForge from '../screens/AgentForge.vue'
import Chat from '../screens/Chat.vue'
import DesignStudio from '../screens/DesignStudio.vue'
import DocRepos from '../screens/DocRepos.vue'
import McpServers from '../screens/McpServers.vue'
import Onboarding from '../screens/Onboarding.vue'
import RealtimeChat from '../screens/RealtimeChat.vue'
import ScratchPad from '../screens/ScratchPad.vue'
import Settings from '../screens/Settings.vue'
import Transcribe from '../screens/Transcribe.vue'
import WebAppViewer from '../screens/WebAppViewer.vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { anyDict } from '../types/index'

const { emitEvent, onEvent } = useEventBus()
const { loadedWebapps, loadWebapp, updateLastUsed, onNavigate, setupEviction, cleanup } = useWebappManager()

const chat = ref<typeof Chat>(null)
const transcribe = ref<typeof Transcribe>(null)
const realtime = ref<typeof RealtimeChat>(null)
const settings = ref<typeof Settings>(null)
const showOnboarding = ref(false)

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

  // Setup webapp eviction interval if feature is enabled
  if (store.isFeatureEnabled('webapps')) {
    setupEviction()
  }

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

  } else if (mode.value === 'none') {
    onMode('chat')
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  cleanup()
})

const onMode = async (next: MenuBarMode) => {

  //console.log('[main] onMode', next)

  if (next === 'computer-use') {
    mode.value = 'chat'
  } else if (next === 'debug') {
    window.api.debug.showConsole()
  } else if (typeof next === 'string' && next.startsWith('webapp-')) {
    // Handle webapp mode
    const webappId = next.replace('webapp-', '')
    loadWebapp(webappId)
    mode.value = next
  } else {
    mode.value = next
  }

  // notify those who care
  await nextTick()
  emitEvent('main-view-changed', next)

  // for menu update
  if (mode.value !== 'computer-use' && mode.value !== 'debug') {
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