
<template>
  <div>
    <div class="group">
      <label></label>
      <span>
        Tavily is a plugin that allows you to use the Tavily API to allow LLM engines to search
        the Internet.
      </span>
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" :disabled="!apiKey" @change="save" />
    </div>
    <div class="group">
      <label>Tavily API Key</label>
      <div class="subgroup">
        <input type="text" v-model="apiKey" @change="save">
        <a href="https://app.tavily.com/home" target="_blank">Get your API key</a>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'

const enabled = ref(false)
const apiKey = ref(null)

const load = () => {
  enabled.value = store.config.plugins.tavily.enabled || false
  apiKey.value = store.config.plugins.tavily.apiKey || ''
}

const save = () => {
  store.config.plugins.tavily.enabled = enabled.value
  store.config.plugins.tavily.apiKey = apiKey.value
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

