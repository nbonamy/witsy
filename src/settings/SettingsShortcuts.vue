<template>
  <div class="content">
    <div class="group">
      <label>New prompt</label>
      <InputShortcut v-model="prompt" @change="save" />
    </div>
    <div class="group">
      <label>New chat</label>
      <InputShortcut v-model="chat" @change="save "/>
    </div>
    <div class="group">
      <label>New Scratchpad</label>
      <InputShortcut v-model="scratchpad" @change="save "/>
    </div>
    <div class="group">
      <label>AI Commands</label>
      <div class="subgroup">
        <InputShortcut v-model="command" @change="save" />
        <span>Usage: Highlight your text, press keyboard shortcut then choose an Al command</span>
      </div>
    </div>
    <div class="group">
      <label>Read Aloud</label>
      <div class="subgroup">
        <InputShortcut v-model="readaloud" @change="save" />
        <span>Usage: Highlight your text, press keyboard shortcut</span>
      </div>
    </div>
    <div class="group">
      <label>Dictation</label>
      <InputShortcut v-model="transcribe" @change="save" />
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import InputShortcut from '../components/InputShortcut.vue'

const prompt = ref(null)
const chat = ref(null)
const scratchpad = ref(null)
const command = ref(null)
const readaloud = ref(null)
const transcribe = ref(null)

const load = () => {
  prompt.value = store.config.shortcuts.prompt
  chat.value = store.config.shortcuts.chat
  scratchpad.value = store.config.shortcuts.scratchpad
  command.value = store.config.shortcuts.command
  readaloud.value = store.config.shortcuts.readaloud
  transcribe.value = store.config.shortcuts.transcribe
}

const save = () => {
  store.config.shortcuts.prompt = prompt.value
  store.config.shortcuts.chat = chat.value
  store.config.shortcuts.scratchpad = scratchpad.value
  store.config.shortcuts.command = command.value
  store.config.shortcuts.readaloud = readaloud.value
  store.config.shortcuts.transcribe = transcribe.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
