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
                <BIconCpu class="icon" />
                <span class="title">General</span>
              </label>
            </li>
            <li class="tab">
              <input type="radio" name="tabs" id="tabOpenAI" />
              <label for="tabOpenAI">
                <BIconAt class="icon" />
                <span class="title">OpenAI</span>
              </label>
            </li>
            <li class="tab">
              <input type="radio" name="tabs" id="tabOllama" />
              <label for="tabOllama">
                <BIconAt class="icon" />
                <span class="title">Ollama</span>
              </label>
            </li>
          </ul>
          <div id="tab-content-General" class="content">
            <div class="group">
              <label>LLM Engine</label>
              <select v-model="general_llmEngine">
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
            <div class="group">
              <label>Chat theme</label>
              <select v-model="general_chatTheme">
                <option value="openai">OpenAI</option>
                <option value="conversation">Conversation</option>
              </select>
            </div>
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
                <input type="text" v-model="openAI_apiKey" @blur="onKeyChange" /><br />
                <a href="https://platform.openai.com/api-keys" target="_blank">Create an API key</a>
              </div>
            </div>
            <div class="group">
              <label>OpenAI Chat Model</label>
              <select v-model="openAI_chat_model" :disabled="openAI_chat_models.length == 0">
                <option v-for="model in openAI_chat_models" :key="model.value" :value="model.value">{{ model.name }}
                </option>
              </select>
            </div>
            <div class="group">
              <label>OpenAI Image Model</label>
              <div class="subgroup">
                <select v-model="openAI_image_model" :disabled="openAI_image_models.length == 0">
                  <option v-for="model in openAI_image_models" :key="model.value" :value="model.value">{{ model.name }}
                  </option>
                </select><br />
                <a href="https://openai.com/pricing" target="_blank">OpenAI pricing</a>
              </div>
            </div>
          </div>
          <div id="tab-content-Ollama" class="content">
            <div class="group">
              <label>Ollama Chat Model</label>
              <select v-model="ollama_chat_model" :disabled="ollama_chat_models.length == 0">
                <option v-for="model in ollama_chat_models" :key="model.value" :value="model.value">{{ model.name }}
                </option>
              </select>
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
import Ollama from '../services/ollama'
import defaults from '../../defaults/settings.json'

const general_llmEngine = ref(store.config.llm.engine || 'openai')
const general_defaultInstructions = ref(store.config.instructions.default || '')
const general_chatTheme = ref(store.config.appearance.chat.theme || 'openai')
const openAI_apiKey = ref(store.config.openAI?.apiKey || '')
const openAI_chat_model = ref(store.config.openAI?.models?.chat || '')
const openAI_image_model = ref(store.config.openAI?.models?.image || '')
const ollama_chat_model = ref(store.config.ollama?.models?.chat || '')
const openAI_chat_models = ref([])
const openAI_image_models = ref([])
const ollama_chat_models = ref([])

onMounted(async () => {
  getOpenAOIModels()
  getOllamaModels()
  showActiveTab()
  installTabs()
})

const showActiveTab = () => {
  window.showActiveTab()
}

const getOpenAOIModels = async () => {
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

const getOllamaModels = async () => {
  const ollama = new Ollama(store.config)
  const models = await ollama.getModels()
  if (models == null) {
    ollama_chat_models.value = []
  } else {
    ollama_chat_models.value = models
      .map(model => { return { name: model.name, value: model.model } })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
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
  store.config.llm.engine = general_llmEngine.value
  store.config.instructions.default = general_defaultInstructions.value
  store.config.appearance.chat.theme = general_chatTheme.value
  store.config.openAI.apiKey = openAI_apiKey.value
  store.config.openAI.models = {
    chat: openAI_chat_model.value,
    image: openAI_image_model.value
  }
  store.config.ollama.models = {
    chat: ollama_chat_model.value
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
dialog {
  width: 600px;
}

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
  padding: 16px 32px;
  height: 170px;
}

textarea {
  height: 50px;
  resize: none;
}
</style>