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
          <ModelSelectPlus id="chat" v-model="chat_model" :models="chat_models" :disabled="chat_models.length == 0" @change="save" />
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
        <a href="https://platform.openai.com/docs/models/continuous-model-upgrades" target="_blank">{{ t('settings.engines.openai.aboutModels') }}</a><br/>
        <a href="https://openai.com/api/pricing/" target="_blank">{{ t('settings.engines.openai.pricing') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus id="vision" v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
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

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory from '../llms/llm'
import Dialog from '../composables/dialog'
import defaults from '../../defaults/settings.json'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const apiKey = ref(null)
const baseURL = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref<string>(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback'), ...defaultCapabilities },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

const load = () => {
  apiKey.value = store.config.engines.openai?.apiKey || ''
  baseURL.value = store.config.engines.openai?.baseURL || ''
  chat_models.value = store.config.engines.openai?.models?.chat || []
  chat_model.value = store.config.engines.openai?.model?.chat || ''
  vision_model.value = store.config.engines.openai?.model?.vision || ''
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
  store.config.engines.openai.model.vision = vision_model.value
  store.config.engines.openai.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
