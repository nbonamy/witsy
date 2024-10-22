<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to create images using OpenAI DALL-E models. You need to have entered your OpenAI API key in the Models tab.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>Image model</label>
      <select v-model="image_model" :disabled="image_models.length == 0" @change="save">
        <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
        </option>
      </select>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
  </div>  
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import { loadOpenAIModels } from '../llms/llm'
import InputObfuscated from '../components/InputObfuscated.vue'

const enabled = ref(false)
const refreshLabel = ref('Refresh')
const image_model = ref(null)
const image_models = ref([])

const load = () => {
  enabled.value = store.config.plugins.dalle.enabled || false
  image_models.value = store.config.engines.openai?.models?.image || []
  image_model.value = store.config.engines.openai?.model?.image || ''
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
  let success = await loadOpenAIModels()
  if (!success) {
    image_models.value = []
    setEphemeralRefreshLabel('Error!')
    return
  }

  // reload
  load()

  // done
  setEphemeralRefreshLabel('Done!')

}

const save = () => {
  store.config.plugins.dalle.enabled = enabled.value
  store.config.engines.openai.model.image = image_model.value
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
