<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="control-group">
        <ModelSelectPlus v-model="chat_model" :models="chat_models" :disabled="chat_models.length == 0" @change="save" />
        <button @click.prevent="onDelete"><BIconTrash /></button>
        <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus v-model="vision_model" :models="vision_models" :height="300" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <OllamaModelPull :pullable-models="getChatModels()" info-url="https://ollama.com/search" info-text="{{ t('settings.engines.ollama.browseModels') }}" @done="onRefresh"/>
    <div class="form-field">
      <label>{{ t('settings.engines.ollama.apiBaseURL') }}</label>
      <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.ollama.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.ollama.keepAlive') }}</label>
      <div class="form-subgroup">
        <input type="text" name="keepAlive" v-model="keepAlive" @change="save" />
        <a href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-keep-a-model-loaded-in-memory-or-make-it-unload-immediately" target="_blank">{{ t('common.learnMore') }}</a>
      </div>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />
      <label>{{ t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { getChatModels } from '../llms/ollama'
import { ChatModel, defaultCapabilities, Ollama } from 'multi-llm-ts'
import Dialog from '../composables/dialog'
import LlmFactory from '../llms/llm'
import defaults from '../../defaults/settings.json'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import OllamaModelPull from '../components/OllamaModelPull.vue'

const baseURL = ref(null)
const keepAlive = ref('')
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
  baseURL.value = store.config.engines.ollama?.baseURL || ''
  chat_models.value = store.config.engines.ollama?.models?.chat || []
  chat_model.value = store.config.engines.ollama?.model?.chat || ''
  vision_model.value = store.config.engines.ollama?.model?.vision || ''
  keepAlive.value = store.config.engines.ollama?.keepAlive || ''
  disableTools.value = store.config.engines.ollama?.disableTools || false
}

const onDelete = () => {
  
  Dialog.show({
    target: document.querySelector('.dialog'),
    title: t('settings.engines.ollama.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      const ollama = new Ollama(store.config.engines.ollama)
      await ollama.deleteModel(chat_model.value)
      onRefresh()
    }
  })

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
  let success = await llmManager.loadModels('ollama')
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    setEphemeralRefreshLabel(t('common.error'))
    return
  }

  // reload
  store.saveSettings()
  load()

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

const save = () => {
  store.config.engines.ollama.baseURL = baseURL.value
  store.config.engines.ollama.model.chat = chat_model.value
  store.config.engines.ollama.model.vision = vision_model.value
  store.config.engines.ollama.keepAlive = keepAlive.value
  store.config.engines.ollama.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

