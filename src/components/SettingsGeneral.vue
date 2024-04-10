
<template>
  <div class="content">
    <div class="group">
      <label>LLM engine</label>
      <select v-model="llmEngine" @change="save">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
    <div class="group">
      <label>Run at login</label>
      <input type="checkbox" v-model="runAtLogin" @change="save" />
    </div>
    <div class="group">
      <label>Keep in Status Bar</label>
      <input type="checkbox" v-model="keepRunning" @change="save" />
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { ipcRenderer } from 'electron'
import { store } from '../services/store'

const llmEngine = ref(null)
const runAtLogin = ref(false)
const keepRunning = ref(false)

const load = () => {
  llmEngine.value = store.config.llm.engine || 'openai'
  runAtLogin.value = ipcRenderer.sendSync('get-run-at-login').openAtLogin
  keepRunning.value = store.config.general.keepRunning
}

const save = () => {
  store.config.llm.engine = llmEngine.value
  ipcRenderer.send('set-run-at-login', runAtLogin.value)
  store.config.general.keepRunning = keepRunning.value
  store.saveSettings()
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
