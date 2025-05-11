<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://platform.openai.com/api-keys" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="subgroup">
        <div class="control-group">
          <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
            <option v-for="model in chat_models" :key="model.id" :value="model.id">{{ model.name }}
            </option>
          </select>
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
        <a href="https://platform.openai.com/docs/models/continuous-model-upgrades" target="_blank">{{ t('settings.engines.openai.aboutModels') }}</a><br/>
        <a href="https://openai.com/pricing" target="_blank">{{ t('settings.engines.openai.pricing') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.openai.apiBaseURL') }}</label>
      <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="group horizontal">
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />
      <label>{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>  
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Dialog from '../composables/dialog'
import defaults from '../../defaults/settings.json'
import InputObfuscated from '../components/InputObfuscated.vue'

const apiKey = ref(null)
const baseURL = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref(null)
const chat_models = ref([])

const load = () => {
  apiKey.value = store.config.engines.openai?.apiKey || ''
  baseURL.value = store.config.engines.openai?.baseURL || ''
  chat_models.value = store.config.engines.openai?.models?.chat || []
  chat_model.value = store.config.engines.openai?.model?.chat || ''
  disableTools.value = store.config.engines.openai?.disableTools || false
}

const onRefresh = async () => {
  refreshLabel.value = t('common.refreshing')
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text: string) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = t('common.refresh'), 2000)
}

const getModels = async () => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('openai')
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    setEphemeralRefreshLabel(t('common.error'))
    return
  }

  // reload
  load()

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.engines.openai.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.openai.apiKey = apiKey.value
  store.config.engines.openai.baseURL = baseURL.value
  store.config.engines.openai.model.chat = chat_model.value
  store.config.engines.openai.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
