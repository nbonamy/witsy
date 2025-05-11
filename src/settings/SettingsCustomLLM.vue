<template>
  <div>
    <div class="group">
      <label>{{ t('common.name') }}</label>
      <input name="label" v-model="label" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="group">
      <label>{{ t('settings.engines.custom.apiSpecification') }}</label>
      <select name="api"v-model="api" :disabled="true">
        <option value="openai">OpenAI</option>
        <option value="azure">Azure OpenAI</option>
      </select>
    </div>
    <template v-if="api === 'openai'">
      <div class="group">
        <label>{{ t('settings.engines.custom.apiBaseURL') }}</label>
        <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @keydown.enter.prevent="save" @change="save"/>
      </div>
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <div class="subgroup">
          <InputObfuscated name="apiKey" v-model="apiKey" @blur="onKeyChange" />
        </div>
      </div>
      <div class="group">
        <label>{{ t('settings.engines.chatModel') }}</label>
        <div class="subgroup">
          <Combobox name="models" :items="chat_models" :placeholder="t('common.modelPlaceholder')" v-model="chat_model" @change="save">
            <button name="refresh"@click.prevent="onRefresh">{{ refreshLabel }}</button>
          </Combobox>
        </div>
      </div>
    </template>
    <template v-if="api === 'azure'">
      <div class="group">
        <label>{{ t('settings.engines.custom.endpoint') }}</label>
        <input name="baseURL" v-model="baseURL" placeholder="https://xxx.openai.azure.com/" />
      </div>
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated name="apiKey" v-model="apiKey" @blur="onKeyChange" />
      </div>
      <div class="group">
        <label>{{ t('settings.engines.custom.deployment') }}</label>
        <input name="deployment" v-model="deployment" />
      </div>
      <div class="group">
        <label>{{ t('settings.engines.custom.apiVersion') }}</label>
        <input name="apiVersion" v-model="apiVersion" />
      </div>
    </template>
    <div class="group horizontal">
      <input type="checkbox" name="disableTools" v-model="disableTools" @change="save" />
      <label>{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../services/i18n'

import { CustomEngineConfig } from '../types/config'
import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Dialog from '../composables/dialog'
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
const deployment = ref(null)
const apiVersion = ref(null)
const refreshLabel = ref(t('common.refresh'))
const disableTools = ref(false)
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
  deployment.value = engineConfig?.deployment || ''
  apiVersion.value = engineConfig?.apiVersion || ''
  chat_models.value = engineConfig?.models?.chat || []
  chat_model.value = engineConfig?.model?.chat || ''
  disableTools.value = engineConfig?.disableTools || false
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

  // // save witsy models
  // const engineConfig = store.config.engines[props.engine] as CustomEngineConfig
  // const witsyModels = engineConfig.models.chat.filter(m => m.meta?.owned_by === 'witsy')
  // const model = engineConfig.model.chat

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModelsCustom(props.engine)
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    setEphemeralRefreshLabel(t('common.error'))
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
  setEphemeralRefreshLabel(t('common.done'))

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
  engineConfig.deployment = deployment.value
  engineConfig.apiVersion = apiVersion.value
  engineConfig.model.chat = chat_model.value
  engineConfig.disableTools = disableTools.value

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
@import '../../css/form.css';
</style>
