<template>
  
  <div class="group">
    <label>{{ t('embedding.provider') }}</label>
    <select v-model="engine" @change="onChangeEngine" required :disabled="disabled">
      <option v-for="e in engines" :key="e.id" :value="e.id">{{ e.name }}</option>
    </select>
  </div>
  
  <div class="group" v-if="llmManager.isCustomEngine(engine)">
    <label>{{ t('embedding.model') }}</label>
    <div class="subgroup">
      <Combobox v-model="model" :items="models"@change="onChangeModel" required :disabled="disabled" />
    </div>
    <button @click.prevent="onRefresh" v-if="canRefresh">{{ refreshLabel }}</button>
  </div>
  
  <div class="group" v-else>
    <label>{{ t('embedding.model') }}</label>
    <select v-model="model" @change="onChangeModel" required :disabled="disabled">
      <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
    </select>
    <button @click.prevent="onRefresh" v-if="canRefresh">{{ refreshLabel }}</button>
  </div>
  
  <div class="group" style="margin-top: -8px" v-if="engine !== 'ollama'">
    <label></label>
    <span>{{ t('embedding.apiKeyReminder') }}</span>
  </div>
  
  <OllamaModelPull 
    v-if="engine === 'ollama'" 
    :pullable-models="getEmbeddingModels" 
    info-url="https://ollama.com/search?c=embedding" 
    :info-text="t('embedding.browse')" 
    @done="onRefresh"
  />
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { Model } from 'multi-llm-ts'
import { ref, computed, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { getEmbeddingModels } from '../llms/ollama'
import LlmFactory, { ILlmManager } from '../llms/llm'
import OllamaModelPull from '../components/OllamaModelPull.vue'
import Combobox from '../components/Combobox.vue'
import Dialog from '../composables/dialog'

const engine = defineModel('engine', { default: 'openai' })
const model = defineModel('model', { default: 'text-embedding-ada-002' })
const refreshLabel = ref('Refresh')

defineProps({
  disabled: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['update'])

const llmManager = LlmFactory.manager(store.config)

const engines = computed(() => {

  // standard
  const engines = [
    { id: 'openai', name: 'OpenAI' },
    //{ id: 'google', name: 'Google' },
    { id: 'ollama', name: 'Ollama' },
    //{ id: 'fastembed', name: 'FastEmbed-js' },
  ]

  // add custom engines
  for (const engine of llmManager.getCustomEngines()) {
    const engineConfig = store.config?.engines?.[engine] as CustomEngineConfig
    if (engineConfig?.api === 'openai'/* && engineConfig?.models?.embedding?.length*/) {
      engines.push({ id: engine, name: engineConfig.label })
    }
  }

  // done
  return engines

})

const models = computed(() => {
  return store.config?.engines?.[engine.value]?.models?.embedding?.map((m: Model) => ({ id: m.id, name: m.name }))
})

const canRefresh = computed(() => ['ollama', 'google'].includes(engine.value))

const onChangeEngine = () => {
  model.value = models.value?.[0]?.id || null
  nextTick(() => {
    onChangeModel()
  })
}

const onChangeModel = () => {
  const downloaded = window.api.docrepo.isEmbeddingAvailable(engine.value, model.value)
  if (!downloaded) {
    Dialog.alert('This model will be downloaded from the internet when adding first document and may take a while.')
  }
  emit('update')
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
  const success = await llmManager.loadModels('ollama')
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    setEphemeralRefreshLabel(t('common.error'))
    return
  }

  // reload
  store.saveSettings()

  // select
  onChangeEngine()

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
