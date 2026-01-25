<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup lang="ts">

import { computed, onMounted, provide, ref, watch, WritableComputedRef } from 'vue'
import { Locale } from 'vue-i18n'
import { strDict } from '../types'
import useAppearanceTheme from './composables/appearance_theme'
import useEventListener from './composables/event_listener'
import useIpcListener from './composables/ipc_listener'
import CommandPicker from './screens/CommandPicker.vue'
import ComputerStatus from './screens/ComputerStatus.vue'
import Debug from './screens/Debug.vue'
import Dictation from './screens/Dictation.vue'
import Main from './screens/Main.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import ReadAloud from './screens/ReadAloud.vue'
import RealtimeChat from './screens/RealtimeChat.vue'
import i18n, { i18nLlm, t } from './services/i18n'
import { store } from './services/store'

// events
const { onDomEvent } = useEventListener()
const { onIpcEvent } = useIpcListener()

// init
const appearanceTheme = useAppearanceTheme()

// routing
const routes: { [key: string]: any } = {
  '/': Main,
  '/chat': Main,
  '/prompt': PromptAnywhere,
  '/commands': CommandPicker,
  '/dictation': Dictation,
  '/readaloud': ReadAloud,
  '/realtime': RealtimeChat,
  '/computer': ComputerStatus,
  '/debug': Debug,
}

const theme = ref('light')
const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  //console.log(currentPath.value.slice(1) || '/')
  return routes[currentPath.value.slice(1) || '/']
})

const queryParams = computed(() => {
  const params = new URLSearchParams(window.location.search);
  const queryParams: strDict = {};
  for (const [key, value] of params) {
    queryParams[key] = decodeURIComponent(value);
  }
  return queryParams;
})

const setTint = () => {
  const tint = appearanceTheme.getTint()
  document.querySelector('body').setAttribute('data-tint', tint)
}

const setLocale = () => {
  
  // ui locale
  const localeUI = window.api.config.localeUI()
  const i18nLocale = (i18n.global.locale as WritableComputedRef<Locale>)
  if (i18nLocale.value !== localeUI) {
    console.log('Changing UI locale to', localeUI)
    i18nLocale.value = localeUI
  }

  // llm locale
  const localeLLM = window.api.config.localeLLM()
  const i18nLlmLocale = (i18nLlm.global.locale as WritableComputedRef<Locale>)
  if (i18nLlmLocale.value !== localeLLM) {
    console.log('Changing LLM locale to', localeLLM)
    i18nLlmLocale.value = localeLLM
  }

  // dom
  const body = document.querySelector('body')
  body.setAttribute('data-locale', localeUI)
  body.classList.remove('colon-spaced', 'colon-notspaced')
  body.classList.add(`colon-${t('common.colon')}`)
}

const onFileModified = (file: string) => {
  if (file === 'settings') {
    setTint()
    setLocale()
  }
}

const onThemeChange = (event: MediaQueryListEvent) => {
  theme.value = event.matches ? 'dark' : 'light'
  setTint()
}

// add platform name
onMounted(() => {

  // config change may lead to tint change
  onIpcEvent('file-modified', onFileModified)

  // platform friendly name
  let platform = {
    'win32': 'windows',
    'darwin': 'macos',
    'linux': 'linux',
  }[window.api.platform]||'generic'

  // add it to the body class
  document.querySelector('body').classList.add(platform)

  // init theme
  theme.value = appearanceTheme.getTheme()
  setTint()

  // init locale
  setLocale()

  // watch for theme change
  if (window.matchMedia) {
    onDomEvent(window.matchMedia('(prefers-color-scheme: dark)'), 'change', onThemeChange as EventListener)
  }

  // watch tint changes in store
  watch(() => [store.config.appearance.lightTint, store.config.appearance.darkTint], setTint)

})

</script>
