<template>
  <div class="commands">
    <div class="command" v-for="command in enabledCommands" :key="command.id" @click="onRunCommand($event, command)">
      <div class="icon">{{ command.icon }}</div>
      <div class="label">{{ command.label }}</div>
      <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
      <div class="action"><component :is="action(command)"></component></div>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import {
  BIconBoxArrowInUpRight,
  BIconArrowReturnLeft,
  BIconInputCursor,
  BIconClipboard
} from 'bootstrap-icons-vue'

const props = defineProps({
  extra: Object
})

const overrideAction = ref(false)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
})

const enabledCommands = computed(() => store.commands.filter(command => command.state == 'enabled'))

const action = (command) => {
  if (overrideAction.value) return BIconBoxArrowInUpRight
  if (command.action == 'chat_window') return BIconBoxArrowInUpRight
  if (command.action == 'paste_below') return BIconArrowReturnLeft
  if (command.action == 'paste_in_place') return BIconInputCursor
  if (command.action == 'clipboard_copy') return BIconClipboard
}

const onKeyDown = (event) => {
  console.log(event)
  if (event.key == 'Shift') {
    overrideAction.value = true
  }
}

const onKeyUp = (event) => {
  overrideAction.value = false
  if (event.key == 'Escape') {
    window.api.commands.closePalette()
  } else {
    for (const command of enabledCommands.value) {
      if (command.shortcut?.toLowerCase() === event.key.toLowerCase()) {
        onRunCommand(event, command)
        break
      }
    }
  }
}

const onRunCommand = (event, command) => {
  
  // if shift key is pressed, run the command in a new window
  if (event.shiftKey) {
    command.action = 'chat_window'
  }

  // now run it
  window.api.commands.run({
    textId: props.extra.textId,
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

.shortcut {
  margin-top: -3px;
  display: inline-block;
  border: 1px solid black;
  border-radius: 4px;
  font-size: 8pt;
  text-transform: capitalize;
  padding: 0px 4px;
  margin-right: 8px
}

.command:hover .shortcut {
  border-color: white;
}

</style>