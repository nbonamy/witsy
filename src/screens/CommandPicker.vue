<template>
  <div class="commands">
    <div class="app" v-if="sourceApp">
      <img class="icon" :src="iconData" /> Working with {{ sourceApp.name }}
    </div>
    <div class="list">
      <div class="command" v-for="command in enabledCommands" :key="command.id" @click="onRunCommand($event, command)">
        <div class="icon">{{ command.icon }}</div>
        <div class="label">{{ command.label }}</div>
        <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { anyDict, Command, ExternalApp } from '../types'
import { ref, Ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'

// load store
store.loadSettings()
store.loadCommands()

let showParams: anyDict = {}
const props = defineProps({
  extra: Object
})

const overrideAction = ref(false)
const sourceApp: Ref<ExternalApp|null> = ref(null)

const iconData = computed(() => {
  const iconContents = window.api.file.readIcon(sourceApp.value.icon)
  return `data:${iconContents.mimeType};base64,${iconContents.contents}`
})

onMounted(() => {

  // shortcuts work better at document level
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('blur', onClose)

  // events
  window.api.on('show', onShow)

  // query params
  if (props.extra) {
    onShow(props.extra)
  }

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('show', onShow)
})

const onShow = (params?: anyDict) => {
  //console.log('CommandPicker.onShow', JSON.stringify(params))
  store.loadCommands()
  showParams = params
  sourceApp.value = showParams?.sourceApp ? window.api.file.getAppInfo(showParams.sourceApp.path) : null
}

const enabledCommands = computed(() => store.commands.filter(command => command.state == 'enabled'))

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key == 'Shift') {
    overrideAction.value = true
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  overrideAction.value = false
  if (event.key == 'Escape') {
    onClose()
  } else {
    for (const command of enabledCommands.value) {
      if (command.shortcut?.toLowerCase() === event.key.toLowerCase()) {
        onRunCommand(event, command)
        break
      }
    }
  }
}

const onClose = () => {
  window.api.commands.closePicker(showParams.sourceApp)
}

const onRunCommand = (event: MouseEvent|KeyboardEvent, command: Command) => {
  window.api.commands.run({
    textId: showParams.textId,
    sourceApp: showParams.sourceApp,
    command: JSON.parse(JSON.stringify(command))
  })
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
  background-color: var(--window-bg-color);
  color: var(--text-color);
  padding: 10px;
}

.app {
  display: flex;
  flex-direction: row;
  background-color: var(--source-app-bg-color);
  color: var(--source-app-text-color);
  border-radius: 6px;
  align-items: center;
  padding: 2px 8px;
  margin-bottom: 8px;
  font-size: 10pt;
  font-weight: 500;
  .icon {
    width: 24px;
    height: 24px;
    margin-right: 4px;
  }
}

.list {
  overflow: auto;
}

.command {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px 8px;
  font-size: 10pt;
  font-family: -apple-system;
}

.commands:has(.app) .command:first-child {
  padding-top: 2px;
}

.command:hover {
  background-color: var(--highlight-color);
  color: var(--highlighted-color);
  border-radius: 6px;
}

.icon {
  flex: 0 0 24px;
  font-size: 13pt;
  text-align: center;
  margin-right: 4px;
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

.shortcut {
  margin-top: -3px;
  display: inline-block;
  border: 1px solid var(--icon-color);
  color: var(--icon-color);
  border-radius: 4px;
  font-size: 8pt;
  text-transform: capitalize;
  padding: 0px 4px;
  margin-right: 8px
}

.action {
  color: var(--icon-color);
}

.command:hover {
  .shortcut, .action {
    color: var(--highlighted-color);
  }
  .shortcut {
    border-color: var(--highlighted-color);
  }
}

</style>