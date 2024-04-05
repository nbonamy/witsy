<template>
  <div class="content">
    <div class="group">
      <label>Ollama chat model</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0">
        <option v-for="model in chat_models" :key="model.value" :value="model.value">{{ model.name }}
        </option>
      </select>
    </div>
  </div>
</template>


<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import Ollama from '../services/ollama'

const chat_model = ref(null)
const chat_models = ref([])

onMounted(async () => {
  getOllamaModels()
})

const load = () => {
  chat_model.value = store.config.ollama?.models?.chat || ''
}

const getOllamaModels = async () => {
  const ollama = new Ollama(store.config)
  const models = await ollama.getModels()
  if (models == null) {
    chat_models.value = []
  } else {
    chat_models.value = models
      .map(model => { return { name: model.name, value: model.model } })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

const save = () => {
  if (chat_model.value != null) {
    store.config.ollama.models.chat = chat_model.value
  }
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