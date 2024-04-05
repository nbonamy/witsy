
<template>
  <div class="content">
    <div class="group">
      <label>LLM engine</label>
      <select v-model="general_llmEngine">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
    <div class="group">
      <label>Default instructions</label>
      <div class="subgroup">
        <textarea v-model="general_defaultInstructions" />
        <a href="#" @click="onResetDefaultInstructions">Reset to default value</a>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, } from 'vue'
import { store } from '../services/store'
import defaults from '../../defaults/settings.json'

const general_llmEngine = ref(null)
const general_defaultInstructions = ref(null)

const load = () => {
  general_llmEngine.value = store.config.llm.engine || 'openai'
  general_defaultInstructions.value = store.config.instructions.default || ''
}

const onResetDefaultInstructions = () => {
  general_defaultInstructions.value = defaults.instructions.default
}

const save = () => {
  store.config.llm.engine = general_llmEngine.value
  store.config.instructions.default = general_defaultInstructions.value
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
