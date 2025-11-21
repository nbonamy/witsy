<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="form-subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://cloud.cerebras.ai/platform/" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="form-subgroup">
        <div class="control-group">
          <ModelSelectPlus v-model="chat_model" :models="chat_models" :height="300" :disabled="chat_models.length == 0" @change="save" />
          <RefreshButton :on-refresh="getModels" />
        </div>
        <a href="https://inference-docs.cerebras.ai/introduction" target="_blank">{{ t('settings.engines.cerebras.aboutModels') }}</a><br/>
        <a href="https://inference-docs.cerebras.ai/support/pricing" target="_blank">{{ t('settings.engines.cerebras.pricing') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="cerebras-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="cerebras-disable-tools">{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import LlmFactory from '@services/llms/llm'
import Dialog from '@renderer/utils/dialog'
import RefreshButton from '../components/RefreshButton.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const apiKey = ref(null)
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
  apiKey.value = store.config.engines.cerebras?.apiKey || ''
  chat_models.value = store.config.engines.cerebras?.models?.chat || []
  chat_model.value = store.config.engines.cerebras?.model?.chat || ''
  vision_model.value = store.config.engines.cerebras?.model?.vision || ''
  disableTools.value = store.config.engines.cerebras?.disableTools || false
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('cerebras')
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
    store.config.engines.cerebras.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.cerebras.apiKey = apiKey.value
  store.config.engines.cerebras.model.chat = chat_model.value
  store.config.engines.cerebras.model.vision = vision_model.value
  store.config.engines.cerebras.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

