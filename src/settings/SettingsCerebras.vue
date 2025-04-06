<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://cloud.cerebras.ai/platform/" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="subgroup">
        <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
          <option v-for="model in chat_models" :key="model.id" :value="model.id">
            {{ model.name }}
          </option>
        </select>
        <a href="https://inference-docs.cerebras.ai/introduction" target="_blank">{{ t('settings.engines.cerebras.aboutModels') }}</a>
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <div class="group">
      <label></label>
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />&nbsp;
      {{  t('settings.engines.disableTools') }}
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Dialog from '../composables/dialog'
import InputObfuscated from '../components/InputObfuscated.vue'

const apiKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref(null)
const chat_models = ref([])

const load = () => {
  apiKey.value = store.config.engines.cerebras?.apiKey || ''
  chat_models.value = store.config.engines.cerebras?.models?.chat || []
  chat_model.value = store.config.engines.cerebras?.model?.chat || ''
  disableTools.value = store.config.engines.cerebras?.disableTools || false
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
  let success = await llmManager.loadModels('cerebras')
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
    store.config.engines.cerebras.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.cerebras.apiKey = apiKey.value
  store.config.engines.cerebras.model.chat = chat_model.value
  store.config.engines.cerebras.disableTools = disableTools.value
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