<template>
  <div class="content">
    <div class="group">
      <label>OpenAI API key</label>
      <div class="subgroup">
        <input type="text" v-model="apiKey" @blur="onKeyChange" /><br />
        <a href="https://platform.openai.com/api-keys" target="_blank">Create an API key</a>
      </div>
    </div>
    <div class="group">
      <label>OpenAI chat model</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0">
        <option v-for="model in chat_models" :key="model.id" :value="model.id">{{ model.name }}
        </option>
      </select>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <div class="group">
      <label>OpenAI image model</label>
      <div class="subgroup">
        <select v-model="image_model" :disabled="image_models.length == 0">
          <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select><br />
        <a href="https://openai.com/pricing" target="_blank">OpenAI pricing</a>
      </div>
      <button style="visibility: hidden">{{ refreshLabel }}</button>
    </div>
  </div>  
</template>


<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import OpenAI from '../services/openai'

const apiKey = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
const image_model = ref(null)
const chat_models = ref([])
const image_models = ref([])

onMounted(async () => {
  await getOpenAIModels()
})

const load = () => {
  apiKey.value = store.config.openai?.apiKey || ''
  chat_model.value = store.config.openai?.model?.chat || ''
  image_model.value = store.config.openai?.model?.image || ''
}

const onRefresh = async () => {
  refreshLabel.value = 'Refreshing...'
  setTimeout(() => getOpenAIModels(), 500)
}

const setEphemeralRefreshLabel = (text) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = 'Refresh', 2000)
}

const getOpenAIModels = async () => {

  const openAI = new OpenAI(store.config)
  let models = await openAI.getModels()
  if (!models) {
    store.config.openai.models = { chat: [], image: [], }
    chat_models.value = []
    image_models.value = []
    setEphemeralRefreshLabel('Error!')
    return
  }

  // xform
  models = models
    .map(model => { return {
      id: model.id,
      name: model.id,
      meta: model
    }})
    .sort((a, b) => a.name.localeCompare(b.name))

  // store
  store.config.openai.models = {
    chat: models.filter(model => model.id.startsWith('gpt-')),
    image: models.filter(model => model.id.startsWith('dall-e-'))
  }

  // assign
  chat_models.value = store.config.openai.models.chat
  image_models.value = store.config.openai.models.image

  // done
  setEphemeralRefreshLabel('Done!')

}

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.openai.apiKey = apiKey.value
    getOpenAIModels()
  }
}

const save = () => {
  store.config.openai.apiKey = apiKey.value
  store.config.openai.model = {
    chat: chat_model.value,
    image: image_model.value
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
