<template>
  <div class="content">
    <div class="group">
      <label>OpenAI API key</label>
      <div class="subgroup">
        <input type="text" v-model="openAI_apiKey" @blur="onKeyChange" /><br />
        <a href="https://platform.openai.com/api-keys" target="_blank">Create an API key</a>
      </div>
    </div>
    <div class="group">
      <label>OpenAI chat model</label>
      <select v-model="openAI_chat_model" :disabled="openAI_chat_models.length == 0">
        <option v-for="model in openAI_chat_models" :key="model.value" :value="model.value">{{ model.name }}
        </option>
      </select>
    </div>
    <div class="group">
      <label>OpenAI image model</label>
      <div class="subgroup">
        <select v-model="openAI_image_model" :disabled="openAI_image_models.length == 0">
          <option v-for="model in openAI_image_models" :key="model.value" :value="model.value">{{ model.name }}
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

const openAI_apiKey = ref(null)
const openAI_chat_model = ref(null)
const openAI_image_model = ref(null)
const openAI_chat_models = ref([])
const openAI_image_models = ref([])

onMounted(async () => {
  getOpenAIModels()
})

const load = () => {
  openAI_apiKey.value = store.config.openai?.apiKey || ''
  openAI_chat_model.value = store.config.openai?.models?.chat || ''
  openAI_image_model.value = store.config.openai?.models?.image || ''
}

const getOpenAIModels = async () => {
  const openAI = new OpenAI(store.config)
  const models = await openAI.getModels()
  if (models == null) {
    openAI_chat_models.value = []
    openAI_image_models.value = []
  } else {
    openAI_chat_models.value = models
      .filter(model => model.id.startsWith('gpt-'))
      .map(model => { return { name: model.id, value: model.id } })
      .sort((a, b) => a.name.localeCompare(b.name))
    openAI_image_models.value = models
      .filter(model => model.id.startsWith('dall-e-'))
      .map(model => { return { name: model.id, value: model.id } })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

const onKeyChange = () => {
  if (openAI_chat_models.value.length === 0 && openAI_apiKey.value.length > 0) {
    store.config.openai.apiKey = openAI_apiKey.value
    getOpenAIModels()
  }
}

const save = () => {
  store.config.openai.apiKey = openAI_apiKey.value
  store.config.openai.models = {
    chat: openAI_chat_model.value,
    image: openAI_image_model.value
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
