<template>
  <div class="settings-panel">
    <div class="form">
      <div class="field">
        <label>GitHub Token</label>
        <input type="password" v-model="apiKey" @change="save" />
        <div class="help">Enter your GitHub token for authentication</div>
      </div>
      <div class="field">
        <label>Base URL</label>
        <input type="text" v-model="baseURL" @change="save" :placeholder="defaultBaseURL" />
        <div class="help">The base URL for GitHub Models API (defaults to models.github.ai/inference)</div>
      </div>
      <div class="field">
        <label>Chat Model</label>
        <select v-model="chatModel" @change="save">
          <option v-for="model in chatModels" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { store } from '../services/store'

const defaultBaseURL = 'https://models.github.ai/inference'
const apiKey = ref('')
const baseURL = ref('')
const chatModel = ref('')
const chatModels = ref(['gpt-4o'])  // Add other supported models as they become available

const load = () => {
  const config = store.config.engines.github
  apiKey.value = config?.apiKey || ''
  baseURL.value = config?.baseURL || defaultBaseURL
  chatModel.value = config?.model?.chat || chatModels.value[0]
}

const save = () => {
  store.config.engines.github.apiKey = apiKey.value
  store.config.engines.github.baseURL = baseURL.value || defaultBaseURL
  store.config.engines.github.model.chat = chatModel.value
  store.saveSettings()
}

onMounted(() => {
  load()
})

defineExpose({ load })
</script>

<style scoped>
@import '../../css/form.css';
</style>
