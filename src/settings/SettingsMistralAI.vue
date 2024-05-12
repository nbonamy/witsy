
<template>
  <div>
    <div class="group">
      <label>API key</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" /><br />
        <a href="https://console.mistral.ai/api-keys/" target="_blank">Get your API key</a>
      </div>
    </div>
    <div class="group">
      <label>Chat model</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
        <option v-for="model in chat_models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import { loadMistralAIModels } from '../services/llm'
import InputObfuscated from '../components/InputObfuscated.vue'

const apiKey = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
const chat_models = ref([])

const load = () => {
  apiKey.value = store.config.engines.mistralai?.apiKey || ''
  chat_models.value = store.config.engines.mistralai?.models.chat || []
  chat_model.value = store.config.engines.mistralai?.model?.chat || ''
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
  let success = await loadMistralAIModels()
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

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.engines.mistralai.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.mistralai.apiKey = apiKey.value
  store.config.engines.mistralai.model.chat = chat_model.value
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
