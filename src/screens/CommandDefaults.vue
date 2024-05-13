<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Commands defaults</div>
      </header>
      <main>
        <div class="group">
          <label>LLM Provider</label>
          <select v-model="engine" @change="onChangeEngine">
            <option value="">Use global default</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="anthropic">Anthropic</option>
            <option value="mistralai">MistralAI</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div class="group">
          <label>LLM Model</label>
          <select v-model="model">
            <option value="" v-if="!models.length">Use global default</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup>

import { ref, computed, watch } from 'vue'
import { store } from '../services/store'

const engine = ref(null)
const model = ref(null)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  engine.value = store.config.commands?.engine || ''
  model.value = store.config.commands?.model || ''
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

const onCancel = () => {
  load()
}

const onSave = (event) => {
  store.config.commands.engine = engine.value
  store.config.commands.model = model.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>
