<template>
  <div class="group">
    <label>{{ t('embedding.provider') }}</label>
    <select v-model="engine" @change="onChangeEngine" required :disabled="disabled">
      <option v-for="e in engines" :key="e.id" :value="e.id">{{ e.name }}</option>
    </select>
  </div>
  <div class="group">
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
    info-url="https://ollama.com/blog/embedding-models" 
    :info-text="t('embedding.browse')" 
    @done="onRefresh"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { CustomEngineConfig } from '../types/config'
import { Model } from 'multi-llm-ts'
import { ref, computed, nextTick } from 'vue'
import { store } from '../services/store'
import { getEmbeddingModels } from '../llms/ollama'
import LlmFactory from '../llms/llm'
import OllamaModelPull from '../components/OllamaModelPull.vue'
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

const llmFactory = new LlmFactory(store.config)

const engines = computed(() => {

  // standard
  const engines = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'ollama', name: 'Ollama' },
    //{ id: 'fastembed', name: 'FastEmbed-js' },
  ]

  // add custom engines
  for (const engine of llmFactory.getCustomEngines()) {
    const engineConfig = store.config?.engines?.[engine] as CustomEngineConfig
    if (engineConfig?.api === 'openai' && engineConfig?.models?.embedding?.length) {
      engines.push({ id: engine, name: engineConfig.label })
    }
  }

  // done
  return engines

})

const models = computed(() => {
  return store.config?.engines?.[engine.value]?.models?.embedding?.map((m: Model) => ({ id: m.id, name: m.name }))
})

const canRefresh = computed(() => engine.value === 'ollama')

const onChangeEngine = () => {
  model.value = models.value?.[0]?.id
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
  const llmFactory = new LlmFactory(store.config)
  const success = await llmFactory.loadModels('ollama')
  if (!success) {
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
@import '../../css/editor.css';
</style>

<style scoped>
#docrepocreate .group label {
  min-width: 150px;
}
</style>
