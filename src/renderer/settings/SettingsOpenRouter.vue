<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="form-subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://openrouter.ai/settings/keys" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="form-subgroup">
        <div class="control-group">
          <ModelSelectPlus v-model="chat_model" :models="chat_models" :height="300" :disabled="chat_models.length == 0" @change="save" />
          <RefreshButton :on-refresh="getModels" />
        </div>
        <a href="https://openrouter.ai/models" target="_blank">{{ t('settings.engines.openrouter.aboutModels') }}</a><br/>
        <a href="https://openrouter.ai/models" target="_blank">{{ t('settings.engines.openrouter.pricing') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.openrouter.providerOrder') }}</label>
      <div class="form-subgroup">
        <textarea name="providerOrder" v-model="providerOrder" @input="save"></textarea>
        <a href="https://openrouter.ai/docs/features/provider-routing#ordering-specific-providers" target="_blank">{{ t('settings.engines.openrouter.aboutOrder') }}</a><br/>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.apiBaseURL') }}</label>
      <input name="baseURL" v-model="baseURL" placeholder="https://openrouter.ai/api/v1" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="openrouter-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="openrouter-disable-tools">{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import LlmFactory from '@services/llms/llm'
import Dialog from '@renderer/utils/dialog'
import RefreshButton from '@components/RefreshButton.vue'
import ModelSelectPlus from '@components/ModelSelectPlus.vue'
import InputObfuscated from '@components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const apiKey = ref(null)
const baseURL = ref(null)
const disableTools = ref(false)
const chat_model = ref<string>(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])
const providerOrder = ref<string>('')

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback'), ...defaultCapabilities },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

const load = () => {
  apiKey.value = store.config.engines.openrouter?.apiKey || ''
  baseURL.value = store.config.engines.openrouter?.baseURL || '' 
  chat_models.value = store.config.engines.openrouter?.models?.chat || []
  chat_model.value = store.config.engines.openrouter?.model?.chat || ''
  vision_model.value = store.config.engines.openrouter?.model?.vision || ''
  disableTools.value = store.config.engines.openrouter?.disableTools || false
  providerOrder.value = store.config.engines.openrouter?.providerOrder || ''
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('openrouter')
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
  }

  // reload
  load()

  // done
  return true

}

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.engines.openrouter.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.openrouter.apiKey = apiKey.value
  store.config.engines.openrouter.baseURL = baseURL.value
  store.config.engines.openrouter.model.chat = chat_model.value
  store.config.engines.openrouter.model.vision = vision_model.value
  store.config.engines.openrouter.disableTools = disableTools.value
  store.config.engines.openrouter.providerOrder = providerOrder.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>

textarea[name="providerOrder"] {
  height: 4lh;
  resize: vertical !important;
}

</style>
