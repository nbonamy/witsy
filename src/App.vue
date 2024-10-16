<template>
  <component :is="currentView" :extra="queryParams" :data-tint="tint"/>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import useAppearanceTheme from './composables/appearance_theme'
import Main from './screens/Main.vue'
import Wait from './screens/Wait.vue'
import Commands from './screens/Commands.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import Experts from './screens/Experts.vue'
import ReadAloud from './screens/ReadAloud.vue'
import Transcribe from './screens/Transcribe.vue'
import ScratchPad from './screens/ScratchPad.vue'

// events
import useEventBus from './composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init
const appearanceTheme = useAppearanceTheme()

// routing
const routes = {
  '/': Main,
  '/chat': Main,
  '/wait': Wait,
  '/command': Commands,
  '/prompt': PromptAnywhere,
  '/experts': Experts,
  '/readaloud': ReadAloud,
  '/transcribe': Transcribe,
  '/scratchpad': ScratchPad,
}

const theme = ref('light')
const tint = ref('black')
const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  //console.log(currentPath.value.slice(1) || '/')
  return routes[currentPath.value.slice(1) || '/']
})

const queryParams = computed(() => {
  const params = new URLSearchParams(window.location.search);
  const queryParams = {};
  for (const [key, value] of params) {
    queryParams[key] = decodeURIComponent(value);
  }
  return queryParams;
})

const loadTint = () => {
  const config = window.api.config.load()
  tint.value = config.appearance.tint || 'black'
}

// add platform name
onMounted(() => {

  // events
  onEvent('appearance-tint-changed', (t) => {
    tint.value = t
  })

  // config change may lead to tint change
  window.api.on('file-modified', (signal) => {
    if (signal === 'settings') {
      loadTint()
    }
  })  

  // platform friendly name
  let platform = {
    'win32': 'windows',
    'darwin': 'macos',
  }[window.api.platform]||'generic'

  // add it everywhere
  window.platform = platform
  document.platform = platform
  document.querySelector('body').classList.add(platform)

  // init theme
  theme.value = appearanceTheme.getTheme()
  loadTint()

  // watch for theme change
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      theme.value = event.matches ? 'dark' : 'light'
      emitEvent('appearance-theme-change', theme.value)
    })
  }

})

</script>
