
<template>
  <div>
    <div class="group">
      <label>Chat model</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
        <option v-for="model in chat_models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <OllamaModelPull :pullable-models="getChatModels" info-url="https://ollama.com/library" info-text="Browse models"/>
    <div class="group">
      <label>API Base URL</label>
      <input v-model="baseURL" :placeholder="defaults.engines.ollama.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { loadOllamaModels } from '../services/llm'
import defaults from '../../defaults/settings.json'
import OllamaModelPull from '../components/OllamaModelPull.vue'
import { getChatModels } from '../services/ollama'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const baseURL = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
const chat_models = ref([])

onMounted(() => {
  onEvent('ollama-pull-done', onRefresh)
})

const load = () => {
  baseURL.value = store.config.engines.ollama?.baseURL || ''
  chat_models.value = store.config.engines.ollama?.models.chat || []
  chat_model.value = store.config.engines.ollama?.model?.chat || ''
}

const onRefresh = async () => {
  refreshLabel.value = 'Refreshing…'
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = 'Refresh', 2000)
}

const getModels = async () => {

  // load
  let success = await loadOllamaModels()
  if (!success) {
    chat_models.value = []
    setEphemeralRefreshLabel('Error!')
    return
  }

  // reload
  store.saveSettings()
  load()

  // done
  setEphemeralRefreshLabel('Done!')

}

const save = () => {
  store.config.engines.ollama.baseURL = baseURL.value
  store.config.engines.ollama.model.chat = chat_model.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

<style scoped>

.pull .subgroup select {
  margin-top: 4px;
  color: #757575;
}

.progress {
  padding: 10px 4px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 9.5pt;
  color: #666;
}

</style>