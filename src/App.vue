<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup lang="ts">

import { strDict } from 'types'
import { ref, computed, onMounted } from 'vue'
import useAppearanceTheme from './composables/appearance_theme'
import Main from './screens/Main.vue'
import Wait from './screens/Wait.vue'
import Commands from './screens/Commands.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import ReadAloud from './screens/ReadAloud.vue'
import Transcribe from './screens/Transcribe.vue'
import ScratchPad from './screens/ScratchPad.vue'

// events
import useEventBus from './composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init
const appearanceTheme = useAppearanceTheme()

// routing
const routes: { [key: string]: any } = {
  '/': Main,
  '/chat': Main,
  '/wait': Wait,
  '/command': Commands,
  '/prompt': PromptAnywhere,
  '/readaloud': ReadAloud,
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

  // watch for theme change
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      theme.value = event.matches ? 'dark' : 'light'
      emitEvent('appearance-theme-change', theme.value)
    })
  }

})

</script>
