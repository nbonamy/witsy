<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="control-group">
        <ModelSelectPlus v-model="chat_model" :models="chat_models" :disabled="chat_models.length == 0" @change="save" />
        <RefreshButton :on-refresh="getModels" />
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus v-model="vision_model" :models="vision_models" :height="300" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.lmstudio.apiKey') }}</label>
      <div class="form-subgroup">
        <InputObfuscated v-model="apiKey" @blur="save" />
        <a href="https://lmstudio.ai/docs/developer/core/authentication" target="_blank">{{ t('common.learnMore') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.lmstudio.apiBaseURL') }}</label>
      <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.lmstudio.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.requestCooldown') }}</label>
      <input type="number" name="requestCooldown" v-model.number="requestCooldown" min="0" step="100" :placeholder="t('settings.engines.requestCooldownHint')" @change="save"/>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="lmstudio-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="lmstudio-disable-tools">{{ t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import { ChatModel, defaultCapabilities, } from 'multi-llm-ts'
import Dialog from '@renderer/utils/dialog'
import InputObfuscated from '@components/InputObfuscated.vue'
import LlmFactory from '@services/llms/llm'
import RefreshButton from '@components/RefreshButton.vue'
import defaults from '@root/defaults/settings.json'
import ModelSelectPlus from '@components/ModelSelectPlus.vue'

const apiKey = ref(null)
const baseURL = ref(null)
const disableTools = ref(false)
const requestCooldown = ref<number>(null)
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
  apiKey.value = store.config.engines.lmstudio?.apiKey || ''
  baseURL.value = store.config.engines.lmstudio?.baseURL || ''
  chat_models.value = store.config.engines.lmstudio?.models?.chat || []
  chat_model.value = store.config.engines.lmstudio?.model?.chat || ''
  vision_model.value = store.config.engines.lmstudio?.model?.vision || ''
  disableTools.value = store.config.engines.lmstudio?.disableTools || false
  requestCooldown.value = store.config.engines.lmstudio?.requestCooldown || null
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('lmstudio')
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
  }

  // reload
  store.saveSettings()
  load()

  // done
  return true

}

const save = () => {
  store.config.engines.lmstudio.apiKey = apiKey.value
  store.config.engines.lmstudio.baseURL = baseURL.value
  store.config.engines.lmstudio.model.chat = chat_model.value
  store.config.engines.lmstudio.model.vision = vision_model.value
  store.config.engines.lmstudio.disableTools = disableTools.value
  store.config.engines.lmstudio.requestCooldown = requestCooldown.value || undefined
  store.saveSettings()
}

defineExpose({ load })

</script>

