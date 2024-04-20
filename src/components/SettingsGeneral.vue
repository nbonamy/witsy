
<template>
  <div class="content">
    <div class="group engine">
      <label>LLM engine</label>
      <select v-model="llmEngine" @change="save">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
        <option value="mistralai">MistralAI</option>
        <option value="anthropic">Anthropic</option>
      </select>
    </div>
    <div class="group language">
      <label>Answer in</label>
      <LangSelect v-model="language" @change="save" />
    </div>
    <div class="group run-at-login">
      <label>Run at login</label>
      <input type="checkbox" v-model="runAtLogin" @change="save" />
    </div>
    <div class="group keep-running">
      <label>Keep in Status Bar</label>
      <input type="checkbox" v-model="keepRunning" @change="save" />
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import LangSelect from './LangSelect.vue'

const llmEngine = ref(null)
const language = ref(null)
const runAtLogin = ref(false)
const keepRunning = ref(false)

const load = () => {
  llmEngine.value = store.config.llm.engine || 'openai'
  language.value = store.config.general.language
  runAtLogin.value = window.api.runAtLogin.get()
  keepRunning.value = store.config.general.keepRunning
}

const save = () => {
  store.config.llm.engine = llmEngine.value
  store.config.general.language = language.value
  window.api.runAtLogin.set(runAtLogin.value)
  store.config.general.keepRunning = keepRunning.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
