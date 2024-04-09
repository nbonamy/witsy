<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { ref, computed } from 'vue'
import Main from './screens/Main.vue'
import Wait from './screens/Wait.vue'
import Commands from './screens/Commands.vue'

// store
import { store } from './services/store'
store.load()

// install shortcuts
ipcRenderer.send('register-shortcuts', JSON.stringify(store.config.shortcuts))

// install commands
import { installCommands } from './services/commands'
installCommands();

// routing
const routes = {
  '/': Main,
  '/chat': Main,
  '/wait': Wait,
  '/command': Commands
}

const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  //console.log(currentPath.value)
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

</script>
