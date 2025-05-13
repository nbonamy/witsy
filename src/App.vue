<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup lang="ts">

import { strDict } from './types'
import { ref, computed, onMounted, WritableComputedRef } from 'vue'
import { Locale } from 'vue-i18n'
import useAppearanceTheme from './composables/appearance_theme'
import Main from './screens/Main.vue'
import CommandPicker from './screens/CommandPicker.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import RealtimeChat from './screens/RealtimeChat.vue'
import ReadAloud from './screens/ReadAloud.vue'
import Transcribe from './screens/Transcribe.vue'
import ScratchPad from './screens/ScratchPad.vue'
import ComputerStatus from './screens/ComputerStatus.vue'
import Debug from './screens/Debug.vue'
import i18n, { i18nLlm, t } from './services/i18n'

// events
import useEventBus from './composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init
const appearanceTheme = useAppearanceTheme()

// routing
const routes: { [key: string]: any } = {
  '/': Main,
  '/chat': Main,
  '/commands': CommandPicker,
  '/prompt': PromptAnywhere,
  '/readaloud': ReadAloud,
  '/realtime': RealtimeChat,
  '/transcribe': Transcribe,
  '/scratchpad': ScratchPad,
  '/computer': ComputerStatus,
  '/debug': Debug,
}

const theme = ref('light')
const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  console.log(currentPath.value.slice(1) || '/')
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

const setTint = (tint?: string) => {
  if (!tint) {
    const config = window.api.config.load()
    tint = config.appearance.tint || 'black'
  }
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

// add platform name
onMounted(() => {

  // events
  onEvent('appearance-tint-changed', (tint: string) => {
    setTint(tint)
  })

  // config change may lead to tint change
  window.api.on('file-modified', (file) => {
    if (file === 'settings') {
      setTint()
      setLocale()
    }
  })  

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
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      theme.value = event.matches ? 'dark' : 'light'
      emitEvent('appearance-theme-change', theme.value)
    })
  }

})

</script>
