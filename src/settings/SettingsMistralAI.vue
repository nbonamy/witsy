<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://console.mistral.ai/api-keys/" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
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
        <a href="https://docs.mistral.ai/docs/models" target="_blank">{{ t('settings.engines.mistralai.aboutModels') }}</a><br/>
        <a href="https://mistral.ai/technology/#pricing" target="_blank">{{ t('settings.engines.mistralai.pricing') }}</a>
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref } from 'vue'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'
import InputObfuscated from '../components/InputObfuscated.vue'

const apiKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const chat_model = ref(null)
const chat_models = ref([])

const load = () => {
  apiKey.value = store.config.engines.mistralai?.apiKey || ''
  chat_models.value = store.config.engines.mistralai?.models?.chat || []
  chat_model.value = store.config.engines.mistralai?.model?.chat || ''
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
  const llmFactory = new LlmFactory(store.config)
  let success = await llmFactory.loadModels('mistralai')
  if (!success) {
    chat_models.value = []
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
    store.config.engines.mistralai.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.mistralai.apiKey = apiKey.value
  store.config.engines.mistralai.model.chat = chat_model.value
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
