<template>
  <div class="commands">
    <div class="command" v-for="command in enabledCommands" :key="command.id" @click="onRunCommand(command)">
      <div class="icon">{{ command.icon }}</div>
      <div class="label">{{ command.label }}</div>
      <div class="behavior"><component :is="behavior(command)"></component></div>
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { computed, onMounted } from 'vue'
import {
  BIconBoxArrowInUpRight,
  BIconArrowReturnLeft,
  BIconInputCursor,
  BIconClipboard
} from 'bootstrap-icons-vue'
import { store } from '../services/store'

const props = defineProps({
  extra: Object
})

onMounted(() => {
  document.addEventListener('keyup', onKeyUp)
})

const enabledCommands = computed(() => store.commands.filter(command => command.state == 'enabled'))

const behavior = (command) => {
  if (command.behavior == 'new_window') return BIconBoxArrowInUpRight
  if (command.behavior == 'insert_below') return BIconArrowReturnLeft
  if (command.behavior == 'replace_selection') return BIconInputCursor
  if (command.behavior == 'copy_cliboard') return BIconClipboard
}

const onKeyUp = (event) => {
  if (event.key == 'Escape') {
    ipcRenderer.send('close-command-palette')
  }
}

const onRunCommand = (command) => {
  ipcRenderer.send('run-command', JSON.stringify({
    text: props.extra.text,
    command: command
  }))
}

</script>

<style scoped>

::-webkit-scrollbar {
  display: none;
}

.commands {
  box-sizing: border-box;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #e7e6e5;
  overflow: auto;
  padding: 10px;
}

.command {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px 8px;
  font-size: 10pt;
  font-family: -apple-system;
}

.command:hover {
  background-color: var(--highlight-color);
  border-radius: 6px;
  color: white;
}

.icon {
  flex: 0 0 24px;
  font-size: 13pt;
  text-align: center;
}

.windows .icon {
  font-size: 12pt;
  font-family: 'NotoColorEmojiLimited'
}

.label {
  flex: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

</style>