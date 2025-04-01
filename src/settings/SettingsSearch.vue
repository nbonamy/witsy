<template>
  <div>

    <div class="description">
      {{ t('settings.plugins.search.description') }}
    </div>

    <div class="group">
      <label>{{ t('common.enabled') }}</label>
      <input type="checkbox" name="enabled" v-model="enabled" @change="save" />
    </div>

    <div class="group">
      <label>{{ t('settings.plugins.search.engine') }}</label>
      <select v-model="engine" name="engine" @change="save">
        <option value="local">{{ t('settings.plugins.search.engines.local') }}</option>
        <option value="brave">{{ t('settings.plugins.search.engines.brave') }}</option>
        <option value="tavily">{{ t('settings.plugins.search.engines.tavily') }}</option>
      </select>
    </div>

    <div class="group" v-if="engine == 'tavily'">
      <label>{{ t('settings.plugins.search.tavilyApiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="tavilyApiKey" name="tavilyApiKey" @change="save" />
        <a href="https://app.tavily.com/home" target="_blank">{{ t('settings.plugins.search.getApiKey') }}</a>
      </div>
    </div>

    <div class="group" v-if="engine == 'brave'">
      <label>{{ t('settings.plugins.search.braveApiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="braveApiKey" name="braveApiKey" @change="save" />
        <a href="https://brave.com/search/api/" target="_blank">{{ t('settings.plugins.search.getApiKey') }}</a>
      </div>
    </div>

    <div class="group">
      <label>{{ t('settings.plugins.search.contentLength') }}</label>
      <div class="subgroup">
        <div>{{ t('settings.plugins.search.truncateTo') }}&nbsp; <input type="text" name="contentLength" v-model="contentLength" @change="save" />&nbsp; {{ t('settings.plugins.search.characters') }}</div>
        <p>{{ t('settings.plugins.search.truncationWarning') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import InputObfuscated from '../components/InputObfuscated.vue'

const enabled = ref(false)
const engine = ref('local')
const contentLength = ref(0)
const tavilyApiKey = ref(null)
const braveApiKey = ref(null)

const load = () => {
  enabled.value = store.config.plugins.search.enabled || false
  engine.value = store.config.plugins.search.engine || 'local'
  contentLength.value = store.config.plugins.search.contentLength ?? 4096
  tavilyApiKey.value = store.config.plugins.search.tavilyApiKey || ''
  braveApiKey.value = store.config.plugins.search.braveApiKey || ''
}

const save = () => {
  store.config.plugins.search.enabled = enabled.value
  store.config.plugins.search.engine = engine.value
  store.config.plugins.search.contentLength = parseInt(contentLength.value.toString()) ?? 4096
  store.config.plugins.search.tavilyApiKey = tavilyApiKey.value
  store.config.plugins.search.braveApiKey = braveApiKey.value
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
