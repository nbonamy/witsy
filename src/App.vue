<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup lang="ts">

import { strDict } from 'types'
import { ref, computed, onMounted } from 'vue'
import useAppearanceTheme from './composables/appearance_theme'
import Main from './screens/Main.vue'
import CommandPicker from './screens/CommandPicker.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import RealtimeChat from './screens/RealtimeChat.vue'
import ReadAloud from './screens/ReadAloud.vue'
import Transcribe from './screens/Transcribe.vue'
import ScratchPad from './screens/ScratchPad.vue'
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

const setTint = (tint?: string) => {
  if (!tint) {
    const config = window.api.config.load()
    tint = config.appearance.tint || 'black'
  }
  document.querySelector('body').setAttribute('data-tint', tint)
}

const setLocale = () => {
  
  // ui locale
  const localeUi = window.api.config.localeUi()
  console.log('Changing locale to', localeUi)
  // @ts-expect-error not sure why
  i18n.global.locale.value = localeUi

  // llm locale
  const localeLlm = window.api.config.localeLlm()
  console.log('Changing llm locale to', localeLlm)
  // @ts-expect-error not sure why
  i18nLlm.global.locale.value = localeLlm

  // dom
  const body = document.querySelector('body')
  body.setAttribute('data-locale', localeUi)
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
  window.api.on('file-modified', (signal) => {
    if (signal === 'settings') {
      setTint()
      setLocale()
    }
  })  

  // platform friendly name
  let platform = {
    'win32': 'windows',
    'darwin': 'macos',
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
