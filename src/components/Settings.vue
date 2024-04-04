
<template>
  <dialog>
    <form method="dialog">
      <header>Settings</header>
      <main>
        <div class="group">
          <label>OpenAI API Key</label>
          <div class="subgroup">
            <input type="text" v-model="openAI_apiKey" /><br/>
            <a href="https://platform.openai.com/api-keys">Create an API key</a>
          </div>
        </div>
        <div class="group">
          <label>OpenAI Chat Model</label>
          <select v-model="openAI_chat_model">
            <option v-for="model in openAI_chat_models" :value="model.value">{{ model.name }}</option>
          </select>
        </div>
        <div class="group">
          <label>OpenAI Image Model</label>
          <div class="subgroup">
            <select v-model="openAI_image_model">
              <option v-for="model in openAI_image_models" :value="model.value">{{ model.name }}</option>
            </select><br/>
            <a href="https://openai.com/pricing">OpenAI pricing</a>
          </div>
        </div>
      </main>
      <footer>
        <button @click="onSubmit" class="default">OK</button>
        <button class="destructive">Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import OpenAI from '../services/openai'

const openAI_apiKey = ref(store.config.openAI?.apiKey || '')
const openAI_chat_model = ref(store.config.openAI?.models?.chat || '')
const openAI_image_model = ref(store.config.openAI?.models?.image || '')
const openAI_chat_models = ref([])
const openAI_image_models = ref([])

onMounted(async () => {
  getOpenAOIModels()
})

const getOpenAOIModels = async () => {
  const openAI = new OpenAI(store.config)
  const models = await openAI.getModels()
  openAI_chat_models.value = models
    .filter(model => model.id.startsWith('gpt-'))
    .map(model => { return { name: model.id, value: model.id } })
    .sort((a, b) => a.name.localeCompare(b.name))
  openAI_image_models.value = models
    .filter(model => model.id.startsWith('dall-e-'))
    .map(model => { return { name: model.id, value: model.id } })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const onSubmit = () => {
  store.config.openAI.apiKey = openAI_apiKey.value
  store.config.openAI.models = {
    chat: openAI_chat_model.value,
    image: openAI_image_model.value
  }
  store.save()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
