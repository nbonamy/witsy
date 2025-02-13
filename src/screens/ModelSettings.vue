<template>
  <div class="model-settings">
    <form class="vertical">
      <div class="group">
        <label>LLM Provider</label>
        <EngineSelect v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="group">
        <label>LLM Model</label>
        <ModelSelect v-model="model" :engine="engine" @change="onChangeModel"/>
      </div>
      <div class="group">
        <label>Plugins</label>
        <select name="plugins" v-model="disableTools" @change="save()">
          <option :value="false">Enabled</option>
          <option :value="true">Disabled</option>
        </select>
      </div>
      <div class="group" v-if="isContextWindowSupported">
        <label>Context Window Size</label>
        <input type="text" name="contextWindowSize" v-model="contextWindowSize" placeholder="Default model value when empty" @change="save"/>
      </div>
      <div class="group" v-if="isMaxTokensSupported">
        <label>Max Completion Tokens</label>
        <input type="text" name="maxTokens" v-model="maxTokens" placeholder="Default model value when empty" @change="save"/>
      </div>
      <div class="group" v-if="isTemperatureSupported">
        <label>Temperature [0.0 … 2.0]</label>
        <input type="text" name="temperature" v-model="temperature" placeholder="Default model value when empty" @change="save"/>
      </div>
      <div class="group" v-if="isTopKSupported">
        <label>TopK / Logprobs [0 … 20]</label>
        <input type="text" name="top_k" v-model="top_k" placeholder="Default model value when empty" @change="save"/>
      </div>
      <div class="group" v-if="isTopPSupported">
        <label>TopP [0.0 … 1.0]</label>
        <input type="text" name="top_p" v-model="top_p" placeholder="Default model value when empty" @change="save"/>
      </div>
      <div class="group" v-if="isReasoningEffortSupported">
        <label>Reasoning Effort</label>
        <select name="reasoningEffort" v-model="reasoningEffort" @change="save">
          <option :value="undefined">Default</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div class="group">
        <label>Defaults for this model</label>
        <div class="subgroup">
          <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">Load</button>
          <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">Save</button>
          <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">Clear</button>
        </div>
      </div>
      <div class="group" v-if="engine === 'ollama'">
        <label>Create new model</label>
        <button type="button" name="create" @click="onCreateOllamaModel" :disabled="!canCreateOllamaModel">Create</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">

import { anyDict } from '../types/index'
import { ref, Ref, onMounted, computed, watch } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory from '../llms/llm'
import Chat from '../models/chat'
import { LlmReasoningEffort } from 'multi-llm-ts'
import { Ollama } from 'ollama/dist/browser.cjs'

const llmFactory = new LlmFactory(store.config)
const engine: Ref<string> = ref(null)
const model: Ref<string> = ref(null)
const disableTools: Ref<boolean> = ref(false)
const contextWindowSize: Ref<number> = ref(undefined)
const maxTokens: Ref<number> = ref(undefined)
const temperature: Ref<number> = ref(undefined)
const top_k: Ref<number> = ref(undefined)
const top_p: Ref<number> = ref(undefined)
const reasoningEffort: Ref<LlmReasoningEffort> = ref(undefined)

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
})

const modelHasDefaults = computed(() => {
  return store.config.llm.defaults.find(d => d.engine === engine.value && d.model === model.value) !== undefined
})

const canSaveAsDefaults = computed(() => {
  return (
    disableTools.value === true ||
    contextWindowSize.value !== undefined ||
    maxTokens.value !== undefined ||
    temperature.value !== undefined ||
    top_k.value !== undefined ||
    top_p.value !== undefined ||
    reasoningEffort.value !== undefined
  )
})

const canCreateOllamaModel = computed(() => {
  return (
    contextWindowSize.value !== undefined ||
    maxTokens.value !== undefined ||
    temperature.value !== undefined ||
    top_k.value !== undefined ||
    top_p.value !== undefined
  )
})

const isContextWindowSupported = computed(() => {
  return engine.value === 'ollama'
})

const isMaxTokensSupported = computed(() => {
  return true
})

const isTemperatureSupported = computed(() => {
  return true
})

const isTopKSupported = computed(() => {
  return engine.value !== 'groq' && engine.value !== 'mistralai' && engine.value !== 'cerebras'
})

const isTopPSupported = computed(() => {
  return true
})

const isReasoningEffortSupported = computed(() => {
  return engine.value === 'openai'
})

onMounted(async () => {
  watch(() => props || {}, () => {
    if (!props.chat) return
    engine.value = props.chat.engine
    model.value = props.chat.model
    disableTools.value = props.chat.disableTools
    contextWindowSize.value = props.chat.modelOpts?.contextWindowSize
    maxTokens.value = props.chat.modelOpts?.maxTokens
    temperature.value = props.chat.modelOpts?.temperature
    top_k.value = props.chat.modelOpts?.top_k
    top_p.value = props.chat.modelOpts?.top_p
    reasoningEffort.value = props.chat.modelOpts?.reasoningEffort
  }, { deep: true, immediate: true })
})

const onLoadDefaults = () => {
  loadDefaults()
  save()
}

const onSaveDefaults = () => {
  saveAsDefaults()
}

const onClearDefaults = () => {
  clearDefaults()
  loadDefaults()
}

const loadDefaults = () => {
  const defaults = store.config.llm.defaults.find(d => d.engine === engine.value && d.model === model.value)
  if (defaults) {
    disableTools.value = defaults.disableTools
    contextWindowSize.value = defaults.contextWindowSize
    maxTokens.value = defaults.maxTokens
    temperature.value = defaults.temperature
    top_k.value = defaults.top_k
    top_p.value = defaults.top_p
    reasoningEffort.value = defaults.reasoningEffort
  } else {
    disableTools.value = false
    contextWindowSize.value = undefined
    maxTokens.value = undefined
    temperature.value = undefined
    top_k.value = undefined
    top_p.value = undefined
    reasoningEffort.value = undefined
  }
}

const saveAsDefaults = () => {
  clearDefaults()
  const modelDefaults = {
    engine: engine.value,
    model: model.value,
    disableTools: disableTools.value,
    contextWindowSize: contextWindowSize.value,
    maxTokens: maxTokens.value,
    temperature: temperature.value,
    top_k: top_k.value,
    top_p: top_p.value,
    reasoningEffort: reasoningEffort.value,
  }
  for (const key of Object.keys(modelDefaults)) {
    if ((modelDefaults as anyDict)[key] === undefined) {
      delete (modelDefaults as anyDict)[key]
    }
  }
  store.config.llm.defaults.push(modelDefaults)
  store.saveSettings()
}

const clearDefaults = () => {
  const index = store.config.llm.defaults.findIndex(d => d.engine === engine.value && d.model === model.value)
  if (index !== -1) {
    store.config.llm.defaults.splice(index, 1)
    store.saveSettings()
  }
}

const onChangeEngine = () => {
  model.value = llmFactory.getChatModel(engine.value, false)
  onChangeModel()
}

const onChangeModel = () => {
  loadDefaults()
  save()
}

const save = () => {

  // check engine
  if (!engine.value.length || !model.value.length) {
    Dialog.show({
      title: 'No LLM Provider or Model selected',
      text: 'Make sure you select a model for this chat.',
      confirmButtonText: 'OK',
    })
    return
  }


  // to check data input
  const parseUserInput = (name: string, ref: any, type: string, min?: number, max?: number): any => {

    // easy stuff
    if (ref.value === undefined || ref.value === null || ref.value === '') return undefined
    const value = type == 'float' ? parseFloat(ref.value) : parseInt(ref.value)
    if (isNaN(value)) {
      ref.value = undefined
      Dialog.show({
        title: `Invalid ${name}`,
        text: `Must be a number`,
        confirmButtonText: 'OK',
      })
      throw new Error(`Invalid ${name}`)
    }

    // check min and max
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      ref.value = undefined
      Dialog.show({
        title: `Invalid ${name}`,
        text: 
          min != undefined && max !== undefined
            ? `Must be between ${min} and ${max}`
            : min !== undefined
              ? `Must be greater than ${min}`
              : `Must be less than ${max}`,
        confirmButtonText: 'OK',
      })
      throw new Error(`Invalid ${name}`)
    }

    // all good
    return value
  }

  // get various data
  try {

    const contextWindowSizeValue = parseUserInput('Context Window Size', contextWindowSize, 'int', 1)
    const maxTokensValue = parseUserInput('Max Completion Tokens', maxTokens, 'int', 1)
    const temperatureValue = parseUserInput('Temperature', temperature, 'float', 0, 2)
    const topKValue = parseUserInput('TopK', top_k, 'int', 0, 20)
    const topPValue = parseUserInput('TopP', top_p, 'float', 0, 1)
    const reasoningEffortValue = reasoningEffort.value ?? undefined

    // update chat
    props.chat.setEngineModel(engine.value, model.value)
    props.chat.disableTools = disableTools.value
    props.chat.modelOpts = {
      contextWindowSize: contextWindowSizeValue,
      maxTokens: maxTokensValue,
      temperature: temperatureValue,
      top_k: topKValue,
      top_p: topPValue,
      reasoningEffort: reasoningEffortValue,
    }

    // set to undefined if all values are undefined
    for (const key of Object.keys(props.chat.modelOpts)) {
      if ((props.chat.modelOpts as anyDict)[key] === undefined) {
        delete (props.chat.modelOpts as anyDict)[key]
      }
    }
    if (Object.keys(props.chat.modelOpts).length === 0) {
      props.chat.modelOpts = undefined
    }

    // special case
    if (!props.chat.hasMessages()) {
      llmFactory.setChatModel(props.chat.engine, props.chat.model)
    }

  } catch (e) {
    console.error(e)
  }

}

const onCreateOllamaModel = async () => {

  let { value: name } = await Dialog.show({
    title: 'Enter new model name',
    input: 'text',
    inputValue: '',
    showCancelButton: true,
  });
  
  if (name) {

    // add suffix
    if (!name.includes(':')) {
      name += ':latest'
    }

    // init
    const ollama = new Ollama({
      host: store.config.engines.ollama.baseURL,
    })

    // create
    await ollama.create({
      model: name,
      from: model.value,
      parameters: {
        num_ctx: contextWindowSize.value,
        num_predict: maxTokens.value,
        temperature: temperature.value,
        top_k: top_k.value,
        top_p: top_p.value,
      }
    })

    // reload
    await llmFactory.loadModels('ollama')

    // and select
    model.value = name
    store.config.engines.ollama.model.chat = name
    store.saveSettings()

  }

}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.model-settings {
  background-color: var(--sidebar-bg-color);
  form {
    padding: 16px;
  }
}

</style>
