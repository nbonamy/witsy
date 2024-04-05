
<template>
  <div class="content">
    <div class="group">
      <label>LLM engine</label>
      <select v-model="llmEngine">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
    <div class="group">
      <label>Default instructions</label>
      <div class="subgroup">
        <textarea v-model="defaultInstructions" />
        <a href="#" @click="onResetDefaultInstructions">Reset to default value</a>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, } from 'vue'
import { store } from '../services/store'
import defaults from '../../defaults/settings.json'

const llmEngine = ref(null)
const defaultInstructions = ref(null)

const load = () => {
  llmEngine.value = store.config.llm.engine || 'openai'
  defaultInstructions.value = store.config.instructions.default || ''
}

const onResetDefaultInstructions = () => {
  defaultInstructions.value = defaults.instructions.default
}

const save = () => {
  store.config.llm.engine = llmEngine.value
  store.config.instructions.default = defaultInstructions.value
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
