
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
    <div class="group pull">
      <label>Pull nodel</label>
      <div class="subgroup">
        <input type="text" v-model="pull_model" placeholder="Enter a model to pull">
        <select v-model="pull_model_select" @change="onSelectPullModel">
          <option disabled value="">Or select one from this list</option>
          <option v-for="model in pull_models" :key="model.id" :value="model.id">
            {{ model.name }}
          </option>
        </select>
        <a href="https://ollama.com/library" target="_blank">Browse models</a>
      </div>
      <div>
        <button @click.prevent="onStop" v-if="pullStream">Stop</button>
        <button @click.prevent="onPull" v-else>Pull</button>
        <div class="progress" v-if="pull_progress">{{  pull_progress }}</div>
      </div>
    </div>
    <div class="group">
      <label>API Base URL</label>
      <input v-model="baseURL" :placeholder="defaults.engines.ollama.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
  </div>
</template>

<script setup>

import { ref, nextTick } from 'vue'
import { store } from '../services/store'
import { loadOllamaModels } from '../services/llm'
import Ollama, { getPullableModels } from '../services/ollama'
import defaults from '../../defaults/settings.json'

const baseURL = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
const chat_models = ref([])
const pull_model = ref(null)
const pull_model_select = ref('')
const pull_models = ref([])
const pull_progress = ref(null)
const pullStream = ref(null)

let ollama = new Ollama(store.config)

const load = () => {
  baseURL.value = store.config.engines.ollama?.baseURL || ''
  chat_models.value = store.config.engines.ollama?.models.chat || []
  chat_model.value = store.config.engines.ollama?.model?.chat || ''
  pull_models.value = getPullableModels
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
  load()

  // done
  setEphemeralRefreshLabel('Done!')

}

const onSelectPullModel = () => {
  pull_model.value = pull_model_select.value
  pull_model_select.value = ''
}

const onPull = () => {
  // need a model and can pull only one at a time
  if (!pull_model.value) return
  if (pullStream.value) return
  pull_progress.value = '…'
  
  // do it
  nextTick(async () => {

    // start pulling
    pullStream.value = await ollama.pullModel(pull_model.value)

    // TODO: handle error (this is not working)
    if (!pullStream.value) {
      alert('Error pulling model')
      pull_progress.value = null
      return
    }

    // report progress
    try {
      for await (const progress of pullStream.value) {
        const percent = Math.floor(progress.completed / progress.total * 100)
        if (!isNaN(percent)) {
          pull_progress.value = percent + '%'
        }
      }
    } catch {}

    // done
    pull_progress.value = null
    pull_model.value = null
    pullStream.value = null
    onRefresh()
  })
}

const onStop = async () => {
  ollama.stop()
  pull_progress.value = null
  pullStream.value = null
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