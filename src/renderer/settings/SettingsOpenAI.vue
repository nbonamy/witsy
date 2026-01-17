<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="form-subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://platform.openai.com/api-keys" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="form-subgroup">
        <div class="control-group">
          <ModelSelectPlus id="chat" v-model="chat_model" :models="chat_models" :height="300" :disabled="chat_models.length == 0" @change="save" />
          <RefreshButton :on-refresh="getModels" ref="refresh" />
        </div>
        <a href="https://platform.openai.com/docs/models/continuous-model-upgrades" target="_blank">{{ t('settings.engines.openai.aboutModels') }}</a><br/>
        <a href="https://openai.com/api/pricing/" target="_blank">{{ t('settings.engines.openai.pricing') }}</a>
      </div>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="openai-hide-dated-models" name="hideDatedModels" v-model="hideDatedModels" @change="onHideDatedModelsChange" />
      <label for="openai-hide-dated-models">{{  t('settings.engines.hideDatedModels') }}</label>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus id="vision" v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.apiBaseURL') }}</label>
      <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.requestCooldown') }}</label>
      <input type="number" name="requestCooldown" v-model.number="requestCooldown" min="0" step="100" :placeholder="t('settings.engines.requestCooldownHint')" @change="save"/>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="openai-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="openai-disable-tools">{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import LlmFactory from '@services/llms/llm'
import Dialog from '@renderer/utils/dialog'
import defaults from '@root/defaults/settings.json'
import RefreshButton from '@components/RefreshButton.vue'
import ModelSelectPlus from '@components/ModelSelectPlus.vue'
import InputObfuscated from '@components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const apiKey = ref(null)
const baseURL = ref(null)
const disableTools = ref(false)
const requestCooldown = ref<number>(null)
const hideDatedModels = ref(true)
const chat_model = ref<string>(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])
const refresh = ref(null)

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback'), ...defaultCapabilities },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

const load = () => {
  apiKey.value = store.config.engines.openai?.apiKey || ''
  baseURL.value = store.config.engines.openai?.baseURL || ''
  hideDatedModels.value = store.config.engines.openai?.hideDatedModels ?? true
  chat_models.value = store.config.engines.openai?.models?.chat || []
  chat_model.value = store.config.engines.openai?.model?.chat || ''
  vision_model.value = store.config.engines.openai?.model?.vision || ''
  disableTools.value = store.config.engines.openai?.disableTools || false
  requestCooldown.value = store.config.engines.openai?.requestCooldown || null
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('openai')
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
    store.config.engines.openai.apiKey = apiKey.value
    getModels()
  }
  save()
}

const onHideDatedModelsChange = () => {
  save()
  refresh.value.refresh()
}

const save = () => {
  store.config.engines.openai.apiKey = apiKey.value
  store.config.engines.openai.baseURL = baseURL.value
  store.config.engines.openai.hideDatedModels = hideDatedModels.value
  store.config.engines.openai.model.chat = chat_model.value
  store.config.engines.openai.model.vision = vision_model.value
  store.config.engines.openai.disableTools = disableTools.value
  store.config.engines.openai.requestCooldown = requestCooldown.value || undefined
  store.saveSettings()
}

defineExpose({ load })

</script>

