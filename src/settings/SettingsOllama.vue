<template>
  <div>
    <div class="group">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <select v-model="chat_model" :disabled="chat_models.length == 0" @change="save">
        <option v-for="model in chat_models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <button @click.prevent="onDelete"><BIconTrash /></button>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <div class="group">
      <label></label>
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />&nbsp;
      {{  t('settings.engines.disableTools') }}
    </div>
    <OllamaModelPull :pullable-models="getChatModels" info-url="https://ollama.com/library" info-text="{{ t('settings.engines.ollama.browseModels') }}" @done="onRefresh"/>
    <div class="group">
      <label>{{ t('settings.engines.ollama.apiBaseURL') }}</label>
      <input v-model="baseURL" :placeholder="defaults.engines.ollama.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { getChatModels } from '../llms/ollama'
import { Ollama } from 'multi-llm-ts'
import Dialog from '../composables/dialog'
import LlmFactory, { ILlmManager } from '../llms/llm'
import defaults from '../../defaults/settings.json'
import OllamaModelPull from '../components/OllamaModelPull.vue'

const baseURL = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
const chat_model = ref(null)
const chat_models = ref([])

const load = () => {
  baseURL.value = store.config.engines.ollama?.baseURL || ''
  chat_models.value = store.config.engines.ollama?.models?.chat || []
  chat_model.value = store.config.engines.ollama?.model?.chat || ''
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
  store.config.engines.ollama.disableTools = disableTools.value
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
