<template>
  <div class="commands tab-content"  @keyup.escape.prevent="onEdit(null)">
    <header v-if="edited">
      <!-- <ChevronLeftIcon class="icon back" @click="onEdit(null)" /> -->
      <div class="title">{{ edited.label || commandI18n(edited, 'label') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.commands') }}</div>
    </header>
    <main class="sliding-root" :class="{ visible: !edited }">
      <CommandsList ref="list" @edit="onEdit" @create="onCreate" />
    </main>
    <main class="editor sliding-pane" :class="{ visible: edited }"> 
      <CommandEditor ref="editor" :command="edited" @command-modified="onCommandModified"/>
    </main>
  </div>
</template>

<script setup lang="ts">

import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import CommandEditor from '../components/CommandEditor.vue'
import CommandsList from '../components/CommandsList.vue'
import { newCommand, saveCommands } from '../services/commands'
import { commandI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { Command } from '../types'

const list = ref(null)
const editor = ref(null)
const selected = ref<Command>(null)
const edited = ref<Command>(null)

const onCreate = (current: Command) => {
  selected.value = current
  edited.value = newCommand()
}

const onEdit = (command: Command) => {
  selected.value = null
  edited.value = command
}

const onCommandModified = (payload: Command) => {

  // cancel
  if (!payload) {
    edited.value = null
    return
  }

  // new command?
  let command = null
  if (payload.id == null) {

    // create a new ome
    command = newCommand()
    command.id = uuidv4()

    // find the index of the currently selected
    const selectedIndex = store.commands.findIndex(p => p.id === selected.value?.id)
    if (selectedIndex !== -1) {
      store.commands.splice(selectedIndex, 0, command)
    } else {
      store.commands.push(command)
    }
    
  } else {
    command = store.commands.find((command: Command) => command.id == payload.id)
  }

  // update
  if (command) {

    // single shortcut
    if (payload.shortcut) {
      for (const c of store.commands) {
        if (c.id != command.id && c.shortcut == payload.shortcut) {
          c.shortcut = null
        }
      }
    }

    // now update
    command.label = payload.label
    command.icon = payload.icon
    command.action = payload.action
    command.template = payload.template
    command.shortcut = payload.shortcut
    command.engine = payload.engine
    command.model = payload.model
  }

  // done
  edited.value = null
  saveCommands()
  load()

}

const load = () => {
  list.value.load()
}

defineExpose({ load })

</script>


<style scoped>

</style>
