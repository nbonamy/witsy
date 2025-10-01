<template>
  <div class="form form-vertical form-large">
    <!-- <div class="form-field">
      <label>{{  t('settings.engines.google.api') }}</label>
      <select name="vertexai" v-model="vertexai" @change="save">
        <option :value="false">{{ t('settings.engines.google.gemini') }}</option>
        <option :value="true">{{ t('settings.engines.google.vertexai') }}</option>
      </select>
    </div> -->
    
    <div class="form-field">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <div class="form-subgroup">
        <InputObfuscated v-model="apiKey" @blur="onKeyChange" />
        <a href="https://aistudio.google.com/app/apikey" target="_blank">{{ t('settings.engines.getApiKey') }}</a>
      </div>
    </div>
    
    <template v-if="vertexai">
      <div class="form-field">
        <label>{{ t('settings.engines.google.project') }}</label>
        <div class="form-subgroup">
          <input type="text" v-model="project" autocapitalize="false" autocomplete="false" autocorrect="false" @blur="onKeyChange" />
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('settings.engines.google.location') }}</label>
        <div class="form-subgroup">
          <input type="text" v-model="location" autocapitalize="false" autocomplete="false" autocorrect="false" @blur="onKeyChange" />
        </div>
      </div>
    </template>
    
    <div class="form-field">
      <label>{{ t('settings.engines.chatModel') }}</label>
      <div class="form-subgroup">
        <div class="control-group">
          <ModelSelectPlus v-model="chat_model" :models="chat_models" :height="300" :disabled="chat_models.length == 0" @change="save" />
          <RefreshButton :on-refresh="getModels" />
        </div>
        <a href="https://ai.google.dev/gemini-api/docs/models/gemini" target="_blank">{{ t('settings.engines.google.aboutModels') }}</a><br/>
        <a href="https://ai.google.dev/pricing" target="_blank">{{ t('settings.engines.google.pricing') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('settings.engines.vision.model') }}</label>
      <ModelSelectPlus v-model="vision_model" :models="vision_models" :disabled="vision_models.length == 0" @change="save" />
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="google-disable-tools" name="disableTools" v-model="disableTools" @change="save" />
      <label for="google-disable-tools">{{  t('settings.engines.disableTools') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory from '../llms/llm'
import Dialog from '../composables/dialog'
import RefreshButton from '../components/RefreshButton.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import { ChatModel, defaultCapabilities } from 'multi-llm-ts'

const vertexai = ref(false)
const apiKey = ref(null)
const project = ref('')
const location = ref('')
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
  // vertexai.value = store.config.engines.google?.googleVertexAI || false
  apiKey.value = store.config.engines.google?.apiKey || ''
  // project.value = store.config.engines.google?.googleVertexProject || ''
  // location.value = store.config.engines.google?.googleVertexLocation || ''
  chat_models.value = store.config.engines.google?.models?.chat || []
  chat_model.value = store.config.engines.google?.model?.chat || ''
  vision_model.value = store.config.engines.google?.model?.vision || ''
  disableTools.value = store.config.engines.google?.disableTools || false
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  let success = await llmManager.loadModels('google')
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
    store.config.engines.google.apiKey = apiKey.value
    getModels()
  }
  save()
}

const save = () => {
  // store.config.engines.google.googleVertexAI = vertexai.value
  store.config.engines.google.apiKey = apiKey.value
  // store.config.engines.google.googleVertexProject = project.value
  // store.config.engines.google.googleVertexLocation = location.value
  store.config.engines.google.model.chat = chat_model.value
  store.config.engines.google.model.vision = vision_model.value
  store.config.engines.google.disableTools = disableTools.value
  store.saveSettings()
}

defineExpose({ load })

</script>

