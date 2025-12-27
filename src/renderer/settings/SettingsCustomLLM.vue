<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('common.name') }}</label>
      <input name="label" v-model="label" @keydown.enter.prevent="save" @change="save"/>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.custom.apiSpecification') }}</label>
      <select name="api"v-model="api" :disabled="true">
        <option value="openai">OpenAI</option>
        <option value="azure">Azure OpenAI</option>
      </select>
    </div>
    <template v-if="api === 'openai'">
      <div class="form-field">
        <label>{{ t('settings.engines.apiBaseURL') }}</label>
        <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @keydown.enter.prevent="save" @change="save"/>
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <div class="form-subgroup">
          <InputObfuscated name="apiKey" v-model="apiKey" @blur="onKeyChange" />
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.chatModel') }}</label>
        <div class="form-subgroup">
          <Combobox name="models" :items="chat_models" :placeholder="t('common.modelPlaceholder')" v-model="chat_model" @change="save">
            <RefreshButton name="refresh" :on-refresh="getModels" ref="refresh" />
          </Combobox>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.vision.model') }}</label>
        <select name="vision_model" v-model="vision_model" :disabled="vision_models.length == 0" @change="save">
          <option v-for="model in vision_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select>
      </div>
    </template>
    <template v-if="api === 'azure'">
      <div class="form-field">
        <label>{{ t('settings.engines.custom.endpoint') }}</label>
        <input name="baseURL" v-model="baseURL" placeholder="https://xxx.openai.azure.com/" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated name="apiKey" v-model="apiKey" @blur="onKeyChange" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.custom.deployment') }}</label>
        <input name="deployment" v-model="deployment" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.custom.apiVersion') }}</label>
        <input name="apiVersion" v-model="apiVersion" />
      </div>
    </template>
    <div class="form-field horizontal">
      <input type="checkbox" id="custom-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="custom-disable-tools">{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@services/i18n'

import { ChatModel } from 'multi-llm-ts'
import { CustomEngineConfig } from 'types/config'
import { computed, onMounted, ref, watch } from 'vue'
import defaults from '@root/defaults/settings.json'
import Combobox from '@components/Combobox.vue'
import InputObfuscated from '@components/InputObfuscated.vue'
import RefreshButton from '@components/RefreshButton.vue'
import Dialog from '@renderer/utils/dialog'
import LlmFactory from '@services/llms/llm'
import LlmManager from '@services/llms/manager'
import { store } from '@services/store'

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
const disableTools = ref(false)
const chat_model = ref<string>(null)
const vision_model = ref<string>(null)
const chat_models = ref<ChatModel[]>([])
const refresh = ref(null)

const vision_models = computed(() => {
  return [
    { id: '', name: t('settings.engines.vision.noFallback') },
    ...chat_models.value.filter(model => model.capabilities?.vision)
  ]
})

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
  vision_model.value = engineConfig?.model?.vision || ''
  disableTools.value = engineConfig?.disableTools || false
}

const getModels = async (): Promise<boolean> => {

  // // save witsy models
  // const engineConfig = store.config.engines[props.engine] as CustomEngineConfig
  // const witsyModels = engineConfig.models.chat.filter(m => m.meta?.owned_by === 'witsy')
  // const model = engineConfig.model.chat

  // load
  const llmManager = LlmFactory.manager(store.config) as LlmManager
  let success = await llmManager.loadModelsCustom(props.engine)
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
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
  return true

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
  engineConfig.model.vision = vision_model.value
  engineConfig.disableTools = disableTools.value

  // now add model to models if it does not exist
  if (chat_model.value && !chat_models.value.find(m => m.id === chat_model.value)) {
    chat_models.value.unshift({
      id: chat_model.value,
      name: chat_model.value,
      meta: { id: chat_model.value, name: chat_model.value },
      capabilities: { tools: true, vision: false, reasoning: false, caching: false }
    })
    engineConfig.models.chat = chat_models.value
  }

  // done
  store.saveSettings()
}

defineExpose({ load, loadModels: () => refresh.value?.refresh() })

</script>

