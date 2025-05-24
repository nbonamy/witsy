<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://console.groq.com/keys" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="subgroup">
        <div class="control-group">
          <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
            <option v-for="model in chat_models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
        <a href="https://console.groq.com/docs/models" target="_blank">{{ t('settings.engines.groq.aboutModels') }}</a><br/>
        <a href="https://groq.com/pricing/" target="_blank">{{ t('settings.engines.groq.pricing') }}</a>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <select name="vision_model" v-model="vision_model" :disabled="vision_models.length == 0" @change="save">
        <option v-for="model in vision_models" :key="model.id" :value="model.id">{{ model.name }}
        </option>
      </select>
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
import InputObfuscated from '../components/InputObfuscated.vue'
import { ChatModel } from 'multi-llm-ts'

const apiKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref<string>(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback') },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

const load = () => {
  apiKey.value = store.config.engines.groq?.apiKey || ''
  chat_models.value = store.config.engines.groq?.models?.chat || []
  chat_model.value = store.config.engines.groq?.model?.chat || ''
  vision_model.value = store.config.engines.groq?.model?.vision || ''
  disableTools.value = store.config.engines.groq?.disableTools || false
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
  let success = await llmManager.loadModels('groq')
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
    store.config.engines.groq.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  store.config.engines.groq.apiKey = apiKey.value
  store.config.engines.groq.model.chat = chat_model.value
  store.config.engines.groq.model.vision = vision_model.value
  store.config.engines.groq.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>