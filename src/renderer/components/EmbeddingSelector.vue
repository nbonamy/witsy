<template>
  
  <div class="form-field">
    <label>{{ t('embedding.provider') }}</label>
    <select v-model="engine" @change="onChangeEngine" required :disabled="disabled">
      <option v-for="e in engines" :key="e.id" :value="e.id">{{ e.name }}</option>
    </select>
  </div>
  
  <div class="form-field" v-if="llmManager.isCustomEngine(engine)">
    <label>{{ t('embedding.model') }}</label>
    <div class="form-subgroup">
      <Combobox v-model="model" :items="models" @change="onChangeModel" required :disabled="disabled" />
    </div>
      <RefreshButton :on-refresh="getModels" v-if="canRefresh"/>
  </div>
  
  <div class="form-field" v-else>
    <label>{{ t('embedding.model') }}</label>
    <div class="form-subgroup">
      <select v-model="model" @change="onChangeModel" required :disabled="disabled">
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
      <RefreshButton :on-refresh="getModels" v-if="canRefresh" ref="refresh"/>
    </div>
  </div>
  
  <div class="form-field" style="margin-top: -8px" v-if="!['ollama', 'lmstudio'].includes(engine)">
    <label></label>
    <span>{{ t('embedding.apiKeyReminder') }}</span>
  </div>
  
  <OllamaModelPull 
    v-if="engine === 'ollama'" 
    :pullable-models="getEmbeddingModels()" 
    info-url="https://ollama.com/search?c=embedding" 
    :info-text="t('embedding.browse')" 
    @done="onRefresh"
  />
</template>

<script setup lang="ts">

import { CustomEngineConfig } from 'types/config'
import { Model } from 'multi-llm-ts'
import { ref, computed, nextTick } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import { getEmbeddingModels } from '@services/llms/ollama'
import LlmFactory from '@services/llms/llm'
import OllamaModelPull from '@components/OllamaModelPull.vue'
import RefreshButton from '@components/RefreshButton.vue'
import Combobox from '@components/Combobox.vue'
import Dialog from '@renderer/utils/dialog'

const engine = defineModel('engine', { default: 'openai' })
const model = defineModel('model', { default: 'text-embedding-ada-002' })

const refresh = ref(null)

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
    { id: 'google', name: 'Google' },
    { id: 'ollama', name: 'Ollama' },
    { id: 'lmstudio', name: 'LM Studio' },
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
  if (['lmstudio'].includes(engine.value)) {
    return store.config?.engines?.[engine.value]?.models?.chat?.map((m: Model) => ({ id: m.id, name: m.name })) 
  } else {
    return store.config?.engines?.[engine.value]?.models?.embedding?.map((m: Model) => ({ id: m.id, name: m.name }))
  }
})

const canRefresh = computed(() => ['ollama', 'google', 'lmstudio'].includes(engine.value))

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
  if (refresh.value) {
    await refresh.value.refresh()
  }
}

const getModels = async (): Promise<boolean> => {

  // load
  const llmManager = LlmFactory.manager(store.config)
  const success = await llmManager.loadModels(engine.value)
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
  }

  // reload
  store.saveSettings()

  // select
  onChangeEngine()

  // done
  return true

}

</script>

<style scoped>

.form.form-vertical .form-field .form-subgroup {
  display: flex;
}

</style>
