<template>
  <div class="content">
    <div class="group">
      <label>Activate chat</label>
      <InputShortcut v-model="chat" />
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { ipcRenderer } from 'electron'
import { store } from '../services/store'
import InputShortcut from './InputShortcut.vue'

const chat = ref(null)

const load = () => {
  chat.value = store.config.shortcuts.chat
}

const save = () => {
  store.config.shortcuts.chat = chat.value
  ipcRenderer.send('register-shortcuts', JSON.stringify(store.config.shortcuts))
  store.save()
}

defineExpose({
  load,
  save
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
