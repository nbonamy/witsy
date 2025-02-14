
<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to search the Internet and use the results as input to
      generate up-to-date responses.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" name="enabled" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>Engine</label>
      <select v-model="engine" name="engine" @change="save">
        <option value="local">Local search (EXPERIMENTAL)</option>
        <option value="tavily">Tavily</option>
      </select>
    </div>
    <div class="group" v-if="engine == 'tavily'">
      <label>Tavily API Key</label>
      <div class="subgroup">
        <InputObfuscated v-model="tavilyApiKey" name="tavilyApiKey" @change="save" />
        <a href="https://app.tavily.com/home" target="_blank">Get your API key</a>
      </div>
    </div>
    <div class="group">
      <label>Content Length</label>
      <div class="subgroup">
        <div>Truncate to&nbsp; <input type="text" name="contentLength" v-model="contentLength" @change="save" />&nbsp; characters (0 for full content)</div>
        <div>WARNING: Truncation length will impact input tokens count and therefore request costs</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import InputObfuscated from '../components/InputObfuscated.vue'

const enabled = ref(false)
const engine = ref('local')
const contentLength = ref(0)
const tavilyApiKey = ref(null)

const load = () => {
  enabled.value = store.config.plugins.search.enabled || false
  engine.value = store.config.plugins.search.engine || 'local'
  contentLength.value = store.config.plugins.search.contentLength || 4096
  tavilyApiKey.value = store.config.plugins.search.tavilyApiKey || ''
}

const save = () => {
  store.config.plugins.search.enabled = enabled.value
  store.config.plugins.search.engine = engine.value
  store.config.plugins.search.contentLength = parseInt(contentLength.value.toString()) ?? 4096
  store.config.plugins.search.tavilyApiKey = tavilyApiKey.value
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

<style scoped>

form .group .subgroup input {
  width: 40px;
}

</style>
