<template>
  <div class="model-settings">
    <form class="vertical">
      <div class="group">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="group">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="model" :engine="engine" @change="onChangeModel"/>
      </div>
      <div class="group">
        <label>{{ t('modelSettings.plugins') }}</label>
        <select name="plugins" v-model="disableTools" @change="save">
          <option :value="false">{{ t('common.enabled') }}</option>
          <option :value="true">{{ t('common.disabled') }}</option>
        </select>
      </div>
      <div class="group">
        <label>{{ t('modelSettings.locale') }}</label>
        <LangSelect name="locale" v-model="locale" default-text="modelSettings.localeDefault" @change="save" />
      </div>
      <div class="group">
        <label>{{ t('modelSettings.prompt') }}</label>
        <textarea name="prompt" v-model="prompt" :placeholder="t('modelSettings.promptPlaceholder')" rows="4" @change="save"></textarea>
      </div>
      <div class="group" v-if="isReasoningFlagSupported">
        <label>{{ t('modelSettings.extendedThinking') }}</label>
        <select name="reasoning" v-model="reasoning" @change="save">
          <option :value="undefined">{{ t('common.default') }}</option>
          <option :value="true">{{ t('common.enabled') }}</option>
          <option :value="false">{{ t('common.disabled') }}</option>
        </select>
      </div>
      <div class="group" v-if="isReasoningEffortSupported">
        <label>{{ t('modelSettings.reasoningEffort') }}</label>
        <select name="reasoningEffort" v-model="reasoningEffort" @change="save">
          <option :value="undefined">{{ t('common.default') }}</option>
          <option value="low">{{ t('common.low') }}</option>
          <option value="medium">{{ t('common.medium') }}</option>
          <option value="high">{{ t('common.high') }}</option>
        </select>
      </div>
      <div class="toggle" @click="showAdvanced = !showAdvanced">
        <span>
          <span v-if="showAdvanced" class="expand">▼</span>
          <span v-else class="expand">▶</span>
          {{ t('modelSettings.advancedSettings') }}
        </span>
      </div>
      <div class="group" v-if="showAdvanced && isContextWindowSupported">
        <label>{{ t('modelSettings.contextWindowSize') }}</label>
        <input type="text" name="contextWindowSize" v-model="contextWindowSize" :placeholder="t('modelSettings.placeholder.defaultModelValue')" @change="save"/>
      </div>
      <div class="group" v-if="showAdvanced && isMaxTokensSupported">
        <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
        <input type="text" name="maxTokens" v-model="maxTokens" :placeholder="t('modelSettings.placeholder.defaultModelValue')" @change="save"/>
      </div>
      <div class="group" v-if="showAdvanced && isTemperatureSupported">
        <label>{{ t('modelSettings.temperature') }}</label>
        <input type="text" name="temperature" v-model="temperature" :placeholder="t('modelSettings.placeholder.defaultModelValue')" @change="save"/>
      </div>
      <div class="group" v-if="showAdvanced && isTopKSupported">
        <label>{{ t('modelSettings.topK') }}</label>
        <input type="text" name="top_k" v-model="top_k" :placeholder="t('modelSettings.placeholder.defaultModelValue')" @change="save"/>
      </div>
      <div class="group" v-if="showAdvanced && isTopPSupported">
        <label>{{ t('modelSettings.topP') }}</label>
        <input type="text" name="top_p" v-model="top_p" :placeholder="t('modelSettings.placeholder.defaultModelValue')" @change="save"/>
      </div>
      <div class="group">
        <label>{{ t('modelSettings.defaultForModel') }}</label>
        <div class="subgroup">
          <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">{{ t('common.load') }}</button>
          <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">{{ t('common.save') }}</button>
          <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">{{ t('common.clear') }}</button>
        </div>
      </div>
      <div class="group" v-if="engine === 'ollama'">
        <label>{{ t('modelSettings.createNewModel') }}</label>
        <button type="button" name="create" @click="onCreateOllamaModel" :disabled="!canCreateOllamaModel">{{ t('common.create') }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">

import { anyDict } from '../types/index'
import { ref, Ref, onMounted, computed, watch } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import LlmFactory from '../llms/llm'
import Chat from '../models/chat'
import { LlmReasoningEffort } from 'multi-llm-ts'
import { Ollama } from 'ollama/dist/browser.cjs'

const llmFactory = new LlmFactory(store.config)
const engine: Ref<string> = ref(null)
const model: Ref<string> = ref(null)
const disableTools: Ref<boolean> = ref(false)
const locale = ref('')
const prompt = ref('')
const showAdvanced = ref(false)
const contextWindowSize: Ref<number> = ref(undefined)
const maxTokens: Ref<number> = ref(undefined)
const temperature: Ref<number> = ref(undefined)
const top_k: Ref<number> = ref(undefined)
const top_p: Ref<number> = ref(undefined)
const reasoning: Ref<boolean> = ref(undefined)
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
    locale.value !== '' ||
    prompt.value !== '' ||
    contextWindowSize.value !== undefined ||
    maxTokens.value !== undefined ||
    temperature.value !== undefined ||
    top_k.value !== undefined ||
    top_p.value !== undefined ||
    reasoning.value !== undefined ||
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

const isReasoningFlagSupported = computed(() => {
  return engine.value === 'anthropic' || engine.value === 'mock'
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
    locale.value = props.chat.locale || ''
    prompt.value = props.chat.prompt || ''
    contextWindowSize.value = props.chat.modelOpts?.contextWindowSize
    maxTokens.value = props.chat.modelOpts?.maxTokens
    temperature.value = props.chat.modelOpts?.temperature
    top_k.value = props.chat.modelOpts?.top_k
    top_p.value = props.chat.modelOpts?.top_p
    reasoning.value = props.chat.modelOpts?.reasoning,
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
    locale.value = defaults.locale || ''
    prompt.value = defaults.prompt || ''
    contextWindowSize.value = defaults.contextWindowSize
    maxTokens.value = defaults.maxTokens
    temperature.value = defaults.temperature
    top_k.value = defaults.top_k
    top_p.value = defaults.top_p
    reasoning.value = defaults.reasoning
    reasoningEffort.value = defaults.reasoningEffort
  } else {
    disableTools.value = false
    locale.value = ''
    prompt.value = ''
    contextWindowSize.value = undefined
    maxTokens.value = undefined
    temperature.value = undefined
    top_k.value = undefined
    top_p.value = undefined
    reasoning.value = undefined
    reasoningEffort.value = undefined
  }
}

const saveAsDefaults = () => {
  clearDefaults()
  const modelDefaults = {
    engine: engine.value,
    model: model.value,
    disableTools: disableTools.value,
    locale: locale.value.trim() || undefined,
    prompt: prompt.value.trim() || undefined,
    contextWindowSize: contextWindowSize.value,
    maxTokens: maxTokens.value,
    temperature: temperature.value,
    top_k: top_k.value,
    top_p: top_p.value,
    reasoning: reasoning.value,
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
      title: t('modelSettings.errors.noProviderOrModel.title'),
      text: t('modelSettings.errors.noProviderOrModel.text'),
      confirmButtonText: t('common.ok'),
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
        title: t('modelSettings.errors.invalid.title', { name }),
        text: t('modelSettings.errors.invalid.mustBeNumber'),
        confirmButtonText: t('common.ok'),
      })
      throw new Error(`Invalid ${name}`)
    }

    // check min and max
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      ref.value = undefined
      Dialog.show({
        title: t('modelSettings.errors.invalid.title', { name }),
        text: 
          min != undefined && max !== undefined
            ? t('modelSettings.errors.invalid.mustBeBetween', { min, max })
            : min !== undefined
              ? t('modelSettings.errors.invalid.mustBeGreaterThan', { min })
              : t('modelSettings.errors.invalid.mustBeLessThan', { max }),
        confirmButtonText: t('common.ok'),
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
    const reasoningValue = reasoning.value ?? undefined
    const reasoningEffortValue = reasoningEffort.value ?? undefined

    // update chat
    props.chat.setEngineModel(engine.value, model.value)
    props.chat.disableTools = disableTools.value
    props.chat.locale = locale.value.trim() || undefined,
    props.chat.prompt = prompt.value.trim() || undefined,
    props.chat.modelOpts = {
      contextWindowSize: contextWindowSizeValue,
      maxTokens: maxTokensValue,
      temperature: temperatureValue,
      top_k: topKValue,
      top_p: topPValue,
      reasoning: reasoningValue,
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
    title: t('modelSettings.createOllama.title'),
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
  height: 100%;
  display: flex;
  flex-direction: column;

  form {
    padding: 16px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
    flex: 1;

    .toggle {
      align-self: flex-start;
      cursor: pointer;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    .subgroup {
      white-space: nowrap;
    }
  }
}

</style>
