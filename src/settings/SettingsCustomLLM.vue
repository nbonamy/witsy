<template>
  <div>
    <div class="group">
      <label>Name</label>
      <input v-model="label" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="group">
      <label>API Specification</label>
      <select v-model="api" @change="save">
        <option value="openai">OpenAI</option>
      </select>
    </div>
    <div class="group">
      <label>API Base URL</label>
      <input v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="group">
      <label>API key</label>
      <div class="subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
      </div>
    </div>
    <div class="group">
      <label>Chat model</label>
      <div class="subgroup">
        <Combobox class="combobox" :items="chat_models" placeholder="Enter a model name or select one" v-model="chat_model" @change="save" />
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
  </div>  
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'
import defaults from '../../defaults/settings.json'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'

const props = defineProps({
  engine: {
    type: String,
    required: true,
  }
})

const label = ref(null)
const api = ref(null)
const apiKey = ref(null)
const baseURL = ref(null)
const refreshLabel = ref('Refresh')
const chat_model = ref(null)
const chat_models = ref([])

onMounted(() => {
  watch(() => props.engine, () => load())
})

const load = () => {
  const engineConfig = store.config.engines[props.engine] as CustomEngineConfig
  label.value = engineConfig?.label || ''
  api.value = engineConfig?.api || ''
  apiKey.value = engineConfig?.apiKey || ''
  baseURL.value = engineConfig?.baseURL || ''
  chat_models.value = engineConfig?.models?.chat || []
  chat_model.value = engineConfig?.model?.chat || ''
}

const onRefresh = async () => {
  refreshLabel.value = 'Refreshing…'
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text: string) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = 'Refresh', 2000)
}

const getModels = async () => {

  // // save witsy models
  // const engineConfig = store.config.engines[props.engine] as CustomEngineConfig
  // const witsyModels = engineConfig.models.chat.filter(m => m.meta?.owned_by === 'witsy')
  // const model = engineConfig.model.chat

  // load
  const llmFactory = new LlmFactory(store.config)
  let success = await llmFactory.loadModelsCustom(props.engine)
  if (!success) {
    chat_models.value = []
    setEphemeralRefreshLabel('Error!')
    return
  }

  // reload
  load()

  // // prepend witsy models
  // if (witsyModels.length) {
  //   chat_models.value = [...witsyModels, ...chat_models.value]
  //   chat_model.value = model
  //   engineConfig.models.chat = chat_models.value
  //   engineConfig.model.chat = model
  //   store.saveSettings()
  // }

  // done
  setEphemeralRefreshLabel('Done!')

}

const onKeyChange = () => {
  if (chat_models.value.length === 0 && apiKey.value.length > 0) {
    store.config.engines[props.engine].apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {

  // easy stuff
  const engineConfig = store.config.engines[props.engine] as CustomEngineConfig
  engineConfig.label = label.value
  engineConfig.api = api.value
  engineConfig.apiKey = apiKey.value
  engineConfig.baseURL = baseURL.value
  engineConfig.model.chat = chat_model.value

  // now add model to models if it does not exist
  if (chat_model.value && !chat_models.value.find(m => m.id === chat_model.value)) {
    chat_models.value.unshift({ id: chat_model.value, name: chat_model.value, meta: { owned_by: 'witsy' } })
    engineConfig.models.chat = chat_models.value
  }

  // done
  store.saveSettings()
}

defineExpose({ load, loadModels: onRefresh })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>
