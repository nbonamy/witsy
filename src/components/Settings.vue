
<template>
  <dialog>
    <form method="dialog">
      <header>Settings</header>
      <main>
        <div class="tabs">
          <ul>
            <li class="tab">
              <input type="radio" name="tabs" id="tabGeneral" checked />
              <label for="tabGeneral">
                <BIconCpu class="icon"/>
                <span class="title">General</span>
              </label>
            </li>
            <li class="tab">
              <input type="radio" name="tabs" id="tabOpenAI" />
              <label for="tabOpenAI">
                <BIconAt class="icon"/>
                <span class="title">OpenAI</span>
              </label>
            </li>
          </ul>
          <div id="tab-content-General" class="content">
            <div class="group">
              <label>Default instructions</label>
              <div class="subgroup">
                <textarea v-model="general_defaultInstructions" />
                <a href="#" @click="onResetDefaultInstructions">Reset to default value</a>
              </div>
            </div>
          </div>
          <div id="tab-content-openAI" class="content">
            <div class="group">
              <label>OpenAI API Key</label>
              <div class="subgroup">
                <input type="text" v-model="openAI_apiKey" @blur="onKeyChange" /><br/>
                <a href="https://platform.openai.com/api-keys" target="_blank">Create an API key</a>
              </div>
            </div>
            <div class="group">
              <label>OpenAI Chat Model</label>
              <select v-model="openAI_chat_model">
                <option v-for="model in openAI_chat_models" :key="model.value" :value="model.value">{{ model.name }}</option>
              </select>
            </div>
            <div class="group">
              <label>OpenAI Image Model</label>
              <div class="subgroup">
                <select v-model="openAI_image_model">
                  <option v-for="model in openAI_image_models" :key="model.value" :value="model.value">{{ model.name }}</option>
                </select><br/>
                <a href="https://openai.com/pricing" target="_blank">OpenAI pricing</a>
              </div>
            </div>
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
import defaults from '../../defaults/settings.json'

const general_defaultInstructions = ref(store.config.instructions.default || '')
const openAI_apiKey = ref(store.config.openAI?.apiKey || '')
const openAI_chat_model = ref(store.config.openAI?.models?.chat || '')
const openAI_image_model = ref(store.config.openAI?.models?.image || '')
const openAI_chat_models = ref([])
const openAI_image_models = ref([])

onMounted(async () => {
  getOpenAOIModels()
  showActiveTab()
  installTabs()
})

const showActiveTab = () => {
  window.showActiveTab()
}

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

const onResetDefaultInstructions = () => {
  general_defaultInstructions.value = defaults.instructions.default
}

const onKeyChange = () => {
  if (openAI_chat_models.value.length === 0 && openAI_apiKey.value.length > 0) {
    store.config.openAI.apiKey = openAI_apiKey.value
    getOpenAOIModels()
  }
}

const onSubmit = () => {
  store.config.instructions.default = general_defaultInstructions.value
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
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>

.tabs .tab>label {
  padding: 0px 16px;
}

.tabs label .icon {
  display: block;
  margin: 0 auto 8px;
  font-size: 16pt;
}

.tabs label .title {
  font-weight: bold;
  font-size: 11pt;
}

.tabs .content {
  padding: 16px;
  height: 170px;
}

textarea {
  height: 50px;
  resize: none;
}

</style>