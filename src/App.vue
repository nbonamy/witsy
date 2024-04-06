<template>
  <component :is="currentView" />
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { ref, computed } from 'vue'
import Main from './screens/Main.vue'
import Wait from './screens/Wait.vue'
import Assistant from './screens/Commands.vue'

// store
import { store } from './services/store'
import defaults from '../defaults/settings.json'
store.load(defaults)

// install shortcuts
ipcRenderer.send('register-shortcuts', JSON.stringify(store.config.shortcuts))

// install commands
import { installCommands } from './services/commands'
installCommands();

// routing
const routes = {
  '/': Main,
  '/wait': Wait,
  '/assistant': Assistant
}

const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  console.log(currentPath.value)
  return routes[currentPath.value.slice(1) || '/']
})


</script>
