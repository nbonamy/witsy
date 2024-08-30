<template>
  <div class="content">
    <div class="group">
      <label>Activate chat</label>
      <InputShortcut v-model="chat" @change="save "/>
    </div>
    <div class="group">
      <label>AI Commands</label>
      <div class="subgroup">
        <InputShortcut v-model="command" @change="save" />
        <span>Usage: Highlight your text, press keyboard shortcut then choose an Al command</span>
      </div>
    </div>
    <div class="group">
      <label>Prompt Anywhere</label>
      <div class="subgroup">
        <InputShortcut v-model="anywhere" @change="save" />
        <span>Usage: Press keyboard shortcut in any editable text input of any app</span>
      </div>
    </div>
    <div class="group">
      <label>Read Aloud</label>
      <div class="subgroup">
        <InputShortcut v-model="readaloud" @change="save" />
        <span>Usage: Highlight your text, press keyboard shortcut</span>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import InputShortcut from '../components/InputShortcut.vue'

const chat = ref(null)
const command = ref(null)
const anywhere = ref(null)
const readaloud = ref(null)

const load = () => {
  chat.value = store.config.shortcuts.chat
  command.value = store.config.shortcuts.command
  anywhere.value = store.config.shortcuts.anywhere
  readaloud.value = store.config.shortcuts.readaloud
}

const save = () => {
  store.config.shortcuts.chat = chat.value
  store.config.shortcuts.command = command.value
  store.config.shortcuts.anywhere = anywhere.value
  store.config.shortcuts.readaloud = readaloud.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
