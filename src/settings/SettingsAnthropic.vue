<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://console.anthropic.com/settings/keys" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="subgroup">
        <div class="control-group">
          <ModelSelect v-model="chat_model" :models="chat_models" :disabled="chat_models.length == 0" @change="save" />
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
        <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank">{{ t('settings.engines.anthropic.aboutModels') }}</a><br/>
        <a href="https://www.anthropic.com/pricing#anthropic-api" target="_blank">{{ t('settings.engines.anthropic.pricing') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelect v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="group horizontal">
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />
      <label>{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory from '../llms/llm'
import Dialog from '../composables/dialog'
import ModelSelect from '../components/ModelSelect.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const apiKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback'), ...defaultCapabilities },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

const load = () => {
  apiKey.value = store.config.engines.anthropic?.apiKey || ''
  chat_models.value = store.config.engines.anthropic?.models?.chat || []
  chat_model.value = store.config.engines.anthropic?.model?.chat || ''
  vision_model.value = store.config.engines.anthropic?.model?.vision || ''
  disableTools.value = store.config.engines.anthropic?.disableTools || false
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
  let success = await llmManager.loadModels('anthropic')
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
    store.config.engines.anthropic.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.anthropic.apiKey = apiKey.value
  store.config.engines.anthropic.model.chat = chat_model.value
  store.config.engines.anthropic.model.vision = vision_model.value
  store.config.engines.anthropic.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>