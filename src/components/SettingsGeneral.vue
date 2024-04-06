
<template>
  <div class="content">
    <div class="group">
      <label>Run at login</label>
      <input type="checkbox" v-model="runAtLogin" />
    </div>
    <div class="group">
      <label>LLM engine</label>
      <select v-model="llmEngine">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { ipcRenderer } from 'electron'
import { store } from '../services/store'

const runAtLogin = ref(false)
const llmEngine = ref(null)

const load = () => {
  runAtLogin.value = ipcRenderer.sendSync('get-run-at-login').openAtLogin
  llmEngine.value = store.config.llm.engine || 'openai'
}

const save = () => {
  store.config.llm.engine = llmEngine.value
  ipcRenderer.send('set-run-at-login', runAtLogin.value)
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
