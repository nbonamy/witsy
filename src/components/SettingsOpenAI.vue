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
        <option v-for="model in chat_models" :key="model.value" :value="model.value">{{ model.name }}
        </option>
      </select>
    </div>
    <div class="group">
      <label>OpenAI image model</label>
      <div class="subgroup">
        <select v-model="image_model" :disabled="image_models.length == 0">
          <option v-for="model in image_models" :key="model.value" :value="model.value">{{ model.name }}
          </option>
        </select><br />
        <a href="https://openai.com/pricing" target="_blank">OpenAI pricing</a>
      </div>
    </div>
  </div>  
</template>


<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import OpenAI from '../services/openai'

const apiKey = ref(null)
const chat_model = ref(null)
const image_model = ref(null)
const chat_models = ref([])
const image_models = ref([])

onMounted(async () => {
  getOpenAIModels()
})

const load = () => {
  apiKey.value = store.config.openai?.apiKey || ''
  chat_model.value = store.config.openai?.models?.chat || ''
  image_model.value = store.config.openai?.models?.image || ''
}

const getOpenAIModels = async () => {
  const openAI = new OpenAI(store.config)
  const models = await openAI.getModels()
  if (models == null) {
    chat_models.value = []
    image_models.value = []
  } else {
    chat_models.value = models
      .filter(model => model.id.startsWith('gpt-'))
      .map(model => { return { name: model.id, value: model.id } })
      .sort((a, b) => a.name.localeCompare(b.name))
    image_models.value = models
      .filter(model => model.id.startsWith('dall-e-'))
      .map(model => { return { name: model.id, value: model.id } })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.openai.apiKey = apiKey.value
    getOpenAIModels()
  }
}

const save = () => {
  store.config.openai.apiKey = apiKey.value
  store.config.openai.models = {
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
