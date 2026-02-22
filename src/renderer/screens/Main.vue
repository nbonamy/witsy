<template>
  <div class="main-window window">

    <header />

    <main>
      
      <MenuBar :mode="mode" @change="onMode" @new-chat="onNewChat" @run-onboarding="onRunOnboarding" @import-markdown="onImportMarkdown" />
      
      <Chat ref="chat" :mode="chatMode" :active="mode === 'chat'" :style="{ display: mode === 'chat' ? undefined : 'none' }" :extra="viewParams" />
      <DesignStudio :style="{ display: mode === 'studio' ? undefined : 'none' }" />
      <RealtimeChat v-if="mode === 'voice-mode'" ref="realtime" />
      <AudioBooth v-if="mode === 'booth'" ref="audioBooth" />
    
      <AgentForge v-if="mode === 'agents'" />
      <McpServers v-if="mode === 'mcp'" />
      <DocRepos v-if="mode === 'docrepos'" :extra="viewParams" />

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

      <Settings :visible="mode === 'settings'" :style="{
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

import { kHistoryVersion } from '@/consts'
import Fullscreen from '@components/Fullscreen.vue'
import MenuBar, { MenuBarMode } from '@components/MenuBar.vue'
import useEventBus from '@composables/event_bus'
import useIpcListener from '@composables/ipc_listener'
import useWebappManager from '@composables/webapp_manager'
import Dialog from '@renderer/utils/dialog'
import AgentForge from '@screens/AgentForge.vue'
import Chat from '@screens/Chat.vue'
import DesignStudio from '@screens/DesignStudio.vue'
import DocRepos from '@screens/DocRepos.vue'
import McpServers from '@screens/McpServers.vue'
import Onboarding from '@screens/Onboarding.vue'
import RealtimeChat from '@screens/RealtimeChat.vue'
import ScratchPad from '@screens/ScratchPad.vue'
import Settings from '@screens/Settings.vue'
import AudioBooth from '@screens/AudioBooth.vue'
import WebAppViewer from '@screens/WebAppViewer.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { ActivityIcon } from 'lucide-vue-next'
import { anyDict } from 'types/index'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const { onBusEvent } = useEventBus()
const { onIpcEvent } = useIpcListener()
const { loadedWebapps, loadWebapp, updateLastUsed, onNavigate, setupEviction, cleanup } = useWebappManager()

const chat = ref<typeof Chat>(null)
const audioBooth = ref<typeof AudioBooth>(null)
const realtime = ref<typeof RealtimeChat>(null)
const settings = ref<typeof Settings>(null)
const showOnboarding = ref(false)

// init stuff
store.load()

const props = defineProps({
  extra: Object
})

const mode = ref<MenuBarMode>('chat')
const chatMode = ref<'chat' | 'computer-use'>('chat')
const viewParams = ref(null)

const version = computed(() => {
  return window.api.app.getVersion()
})

const onWindowClosed = () => {
  mode.value = 'none'
}

const onWindowOpened = () => {
  // history version check
  if (store.history.version != null && store.history.version > kHistoryVersion) {
    Dialog.show({
      title: t('main.historyVersionMismatch.title'),
      text: t('main.historyVersionMismatch.text'),
    })
    return
  }

  // show onboarding when window opens
  if (!store.config.general.onboardingDone) {
    setTimeout(() => showOnboarding.value = true, 500)
  }
}

onMounted(() => {

  console.log('[main] mounted')

  // IPC events
  onIpcEvent('window-closed', onWindowClosed)
  onIpcEvent('query-params', processQueryParams)
  onIpcEvent('start-dictation', onDictate)
  onIpcEvent('window-opened', onWindowOpened)
  onIpcEvent('run-onboarding', onRunOnboarding)

  // init from props
  if (props.extra) {
    processQueryParams(props.extra)
  }

  // internal messages
  onBusEvent('new-chat', () => onMode('chat'))
  onBusEvent('set-main-window-mode', (next: MenuBarMode) => {
    onMode(next)
  })

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

  } else if (mode.value === 'none') {
    onMode('chat')
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  cleanup()
})

const onMode = (next: MenuBarMode) => {

  //console.log('[main] onMode', next)

  // hide settings when leaving settings mode
  if (mode.value === 'settings' && next !== 'settings') {
    settings.value?.onHide()
  }

  if (next === 'computer-use') {
    mode.value = 'chat'
    chatMode.value = 'computer-use'
  } else if (next === 'debug') {
    window.api.debug.showConsole()
  } else if (typeof next === 'string' && next.startsWith('webapp-')) {
    // Handle webapp mode
    const webappId = next.replace('webapp-', '')
    loadWebapp(webappId)
    mode.value = next
  } else {
    mode.value = next
    chatMode.value = 'chat'
  }

  // for menu update
  if (mode.value !== 'computer-use' && mode.value !== 'debug') {
    window.api.main.updateMode(mode.value)
  }

}

const onDictate = () => {
  if (mode.value === 'chat') {
    chat.value?.startDictation()
  } else if (mode.value === 'booth') {
    audioBooth.value?.startDictation()
  } else if (mode.value === 'voice-mode') {
    realtime.value?.startDictation()
  }
}

const onNewChat = () => {
  chat.value?.newChat()
  onMode('chat')
}

const onImportMarkdown = (chatData: any) => {
  chat.value?.importChat(chatData)
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
@import '@css/swal2.css';
</style>

<style>

/* hack! */
.main-window:has(~ .fullscreen-drawer.visible) {
  main .settings * {
    z-index: -1 !important;
  }
}

</style>