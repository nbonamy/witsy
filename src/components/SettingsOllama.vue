
<template>
  <div class="content">
    <div class="group">
      <label>Ollama chat model</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0">
        <option v-for="model in chat_models" :key="model.id" :value="model.id">{{ model.name }}
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
  await getOllamaModels()
})

const load = () => {
  if (store.models.ollama == null)  getOllamaModels()
  chat_model.value = store.config.ollama?.models?.chat || ''
}

const getOllamaModels = async () => {

  // load if needed
  if (!store.models.ollama) {
    const ollama = new Ollama(store.config)
    const models = await ollama.getModels()
    if (!models) {
      store.models.ollama = null
    } else {
      store.models.ollama = models
        .map(model => { return {
          id: model.model,
          name: model.name,
          meta: model
        }})
        .sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  // assign
  chat_models.value = store.models.ollama || []

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