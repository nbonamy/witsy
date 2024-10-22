<template>
  <div>
    <div class="group">
      <label>API key</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://aistudio.google.com/app/apikey" target="_blank">Get your API key</a>
      </div>
    </div>
    <div class="group">
      <label>Chat model</label>
      <div class="subgroup">
        <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
          <option v-for="model in chat_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select>
        <br />
        <a href="https://ai.google.dev/gemini-api/docs/models/gemini" target="_blank">More about Google models</a><br/>
        <a href="https://ai.google.dev/pricing" target="_blank">Google pricing</a>
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
  </div>  
</template>


<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import { loadGoogleModels } from '../llms/llm'
import InputObfuscated from '../components/InputObfuscated.vue'

const apiKey = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
//const image_model = ref(null)
const chat_models = ref([])
//const image_models = ref([])

const load = () => {
  apiKey.value = store.config.engines.google?.apiKey || ''
  chat_models.value = store.config.engines.google?.models?.chat || []
  //image_models.value = store.config.engines.google?.models?.image || []
  chat_model.value = store.config.engines.google?.model?.chat || ''
  //image_model.value = store.config.engines.google?.model?.image || ''
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
  let success = await loadGoogleModels()
  if (!success) {
    chat_models.value = []
    //image_models.value = []
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
    store.config.engines.google.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.google.apiKey = apiKey.value
  store.config.engines.google.model = {
    chat: chat_model.value,
    //image: image_model.value
  }
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
