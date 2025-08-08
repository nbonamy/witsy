<template>
  <div class="model-settings">
    <div class="form form-vertical">
      <div class="form-field">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelectPlus v-model="model" :caps-hover-only="true" :engine="engine" @change="onChangeModel"/>
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.plugins') }}</label>
        <select name="plugins" v-model="disableTools" @change="onChangeTools">
          <option :value="false">{{ t('common.enabled') }}</option>
          <option :value="true">{{ t('common.disabled') }}</option>
        </select>
        <div v-if="!disableTools" class="tools">
          <button @click.prevent="onCustomizeTools">{{ t('common.customize') }}</button>
          <div style="color: var(--dimmed-text-color)" v-if="!areToolsDisabled(tools) && !areAllToolsEnabled(tools)">&nbsp;{{ t('modelSettings.toolsCount', { count: tools.length }) }}</div>
          <div style="color: var(--dimmed-text-color)" v-if="areAllToolsEnabled(tools)">&nbsp;{{ t('modelSettings.allToolsEnabled') }}</div>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.locale') }}</label>
        <LangSelect name="locale" v-model="locale" default-text="modelSettings.localeDefault" @change="save" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.instructions') }}</label>
        <textarea name="instructions" v-model="instructions" :placeholder="t('modelSettings.instructionsPlaceholder')" rows="4" @change="save"></textarea>
      </div>
      <div class="form-field" v-if="isReasoningFlagSupported">
        <label>{{ t('modelSettings.extendedThinking') }}</label>
        <select name="reasoning" v-model="reasoning" @change="save">
          <option :value="undefined">{{ t('common.default') }}</option>
          <option :value="true">{{ t('common.enabled') }}</option>
          <option :value="false">{{ t('common.disabled') }}</option>
        </select>
      </div>
      <div class="form-field" v-if="isReasoningEffortSupported">
        <label>{{ t('modelSettings.reasoningEffort') }}</label>
        <select name="reasoningEffort" v-model="reasoningEffort" @change="save">
          <option :value="undefined">{{ t('common.default') }}</option>
          <option value="low">{{ t('common.low') }}</option>
          <option value="medium">{{ t('common.medium') }}</option>
          <option value="high">{{ t('common.high') }}</option>
        </select>
      </div>
      <div class="form-field" v-if="isVerbositySupported">
        <label>{{ t('modelSettings.verbosity') }}</label>
        <select name="verbosity" v-model="verbosity" @change="save">
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
      <div class="form-field" v-if="showAdvanced">
        <label>{{ t('modelSettings.streaming') }}</label>
        <select name="streaming" v-model="disableStreaming" @change="save">
          <option :value="false">{{ t('common.enabled') }}</option>
          <option :value="true">{{ t('common.disabled') }}</option>
        </select>
      </div>
      <div class="form-field" v-if="showAdvanced && isContextWindowSupported">
        <label>{{ t('modelSettings.contextWindowSize') }}</label>
        <input type="text" name="contextWindowSize" v-model="contextWindowSize" :placeholder="t('modelSettings.defaultModelValue')" @change="save"/>
      </div>
      <div class="form-field" v-if="showAdvanced && isMaxTokensSupported">
        <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
        <input type="text" name="maxTokens" v-model="maxTokens" :placeholder="t('modelSettings.defaultModelValue')" @change="save"/>
      </div>
      <div class="form-field" v-if="showAdvanced && isTemperatureSupported">
        <label>{{ t('modelSettings.temperature') }}</label>
        <input type="text" name="temperature" v-model="temperature" :placeholder="t('modelSettings.defaultModelValue')" @change="save"/>
      </div>
      <div class="form-field" v-if="showAdvanced && isTopKSupported">
        <label>{{ t('modelSettings.topK') }}</label>
        <input type="text" name="top_k" v-model="top_k" :placeholder="t('modelSettings.defaultModelValue')" @change="save"/>
      </div>
      <div class="form-field" v-if="showAdvanced && isTopPSupported">
        <label>{{ t('modelSettings.topP') }}</label>
        <input type="text" name="top_p" v-model="top_p" :placeholder="t('modelSettings.defaultModelValue')" @change="save"/>
      </div>

      <div class="form-field custom" v-if="showAdvanced && modelHasCustomParams">
        <label>{{ t('modelSettings.customParams') }}</label>
        <VariableTable
            :variables="customParams"
            :selectedVariable="selectedParam"
            @select="onSelectParam"
            @add="onAddParam"
            @edit="onEditParam"
            @delete="onDelParam"
          />
      </div>

      <div class="form-field">
        <label>{{ t('modelSettings.defaultForModel') }}</label>
        <div class="form-subgroup">
          <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">{{ t('common.load') }}</button>
          <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">{{ t('common.save') }}</button>
          <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">{{ t('common.clear') }}</button>
        </div>
      </div>
      <div class="form-field" v-if="engine === 'ollama'">
        <label>{{ t('modelSettings.createNewModel') }}</label>
        <button type="button" name="create" @click="onCreateOllamaModel" :disabled="!canCreateOllamaModel">{{ t('common.create') }}</button>
      </div>
    </div>

    <ToolSelector ref="selector" @save="onSaveTools" />
    <VariableEditor ref="editor" id="model-variable-editor" title="designStudio.variableEditor.title" :variable="selectedParam" @save="onSaveParam" />

  </div>

</template>

<script setup lang="ts">

import { anyDict } from '../types/index'
import { LlmReasoningEffort, LlmVerbosity } from 'multi-llm-ts'
import { ref, onMounted, computed, watch } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import LangSelect from '../components/LangSelect.vue'
import VariableTable from '../components/VariableTable.vue'
import VariableEditor from '../screens/VariableEditor.vue'
import ToolSelector from '../screens/ToolSelector.vue'
import LlmFactory, { areToolsDisabled, areAllToolsEnabled, ILlmManager } from '../llms/llm'
import Chat from '../models/chat'
import { Ollama } from 'ollama/dist/browser.cjs'

const editor = ref(null)
const selector = ref(null)
const llmManager: ILlmManager = LlmFactory.manager(store.config)
const engine = ref<string>(null)
const model = ref<string>(null)
const disableStreaming = ref<boolean>(false)
const disableTools = ref<boolean>(false)
const tools = ref<string[]>(null)
const locale = ref('')
const instructions = ref('')
const showAdvanced = ref(false)
const contextWindowSize = ref<number>(undefined)
const maxTokens = ref<number>(undefined)
const temperature = ref<number>(undefined)
const top_k = ref<number>(undefined)
const top_p = ref<number>(undefined)
const reasoning = ref<boolean>(undefined)
const reasoningEffort = ref<LlmReasoningEffort>(undefined)
const verbosity = ref<LlmVerbosity>(undefined)
const customParams = ref<Record<string, string>>({})
const selectedParam = ref(null)

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
    disableStreaming.value === true ||
    disableTools.value === true ||
    tools.value !== null ||
    locale.value !== '' ||
    instructions.value !== '' ||
    contextWindowSize.value !== undefined ||
    maxTokens.value !== undefined ||
    temperature.value !== undefined ||
    top_k.value !== undefined ||
    top_p.value !== undefined ||
    reasoning.value !== undefined ||
    reasoningEffort.value !== undefined ||
    verbosity.value !== undefined ||
    Object.keys(customParams.value).length > 0
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

const isVerbositySupported = computed(() => {
  return engine.value === 'openai' && model.value.startsWith('gpt-5')
})

const modelHasCustomParams = computed(() => {
  return llmManager.isCustomEngine(engine.value)
})

onMounted(async () => {
  watch(() => props || {}, () => {
    if (!props.chat) return
    engine.value = props.chat.engine
    model.value = props.chat.model
    disableStreaming.value = props.chat.disableStreaming
    disableTools.value = areToolsDisabled(props.chat.tools)
    tools.value = props.chat.tools
    locale.value = props.chat.locale || ''
    instructions.value = props.chat.instructions || ''
    contextWindowSize.value = props.chat.modelOpts?.contextWindowSize
    maxTokens.value = props.chat.modelOpts?.maxTokens
    temperature.value = props.chat.modelOpts?.temperature
    top_k.value = props.chat.modelOpts?.top_k
    top_p.value = props.chat.modelOpts?.top_p
    reasoning.value = props.chat.modelOpts?.reasoning,
    reasoningEffort.value = props.chat.modelOpts?.reasoningEffort,
    customParams.value = props.chat.modelOpts?.customOpts || {}
  }, { deep: true, immediate: true })
})

const onCustomizeTools = () => {
  selector.value.show(tools.value)
}

const onSaveTools = (selected: string[]) => {
  tools.value = selected
  save()
}

const onSelectParam = (key: string) => {
  selectedParam.value = { key, value: customParams.value[key] }
}

const onAddParam = () => {
  selectedParam.value = { key: '', value: '' }
  editor.value.show()
}

const onDelParam = () => {
  if (selectedParam.value) {
    delete customParams.value[selectedParam.value.key]
    customParams.value = { ...customParams.value }
  }
  save()
}

const onEditParam = (key: string) => {
  selectedParam.value = { key, value: customParams.value[key] }
  editor.value.show()
}

const onSaveParam = (param: { key: string, value: string }) => {
  if (param.key.length) {
    if (param.key != selectedParam.value.key) {
      delete customParams.value[selectedParam.value.key]
    }
    let value: any = param.value
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (!isNaN(value)) value = parseFloat(value)
    customParams.value[param.key] = value
    customParams.value = { ...customParams.value }
  }
  save()
}

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
    disableStreaming.value = defaults.disableStreaming
    disableTools.value = areToolsDisabled(defaults.tools)
    tools.value = defaults.tools
    locale.value = defaults.locale || ''
    instructions.value = defaults.instructions || ''
    contextWindowSize.value = defaults.contextWindowSize
    maxTokens.value = defaults.maxTokens
    temperature.value = defaults.temperature
    top_k.value = defaults.top_k
    top_p.value = defaults.top_p
    reasoning.value = defaults.reasoning
    reasoningEffort.value = defaults.reasoningEffort
    verbosity.value = defaults.verbosity
    customParams.value = defaults.customOpts || {}
  } else {
    disableStreaming.value = false
    disableTools.value = false
    tools.value = null
    locale.value = ''
    instructions.value = ''
    contextWindowSize.value = undefined
    maxTokens.value = undefined
    temperature.value = undefined
    top_k.value = undefined
    top_p.value = undefined
    reasoning.value = undefined
    reasoningEffort.value = undefined
    verbosity.value = undefined
    customParams.value = {}
  }
}

const saveAsDefaults = () => {
  clearDefaults()
  const modelDefaults = {
    engine: engine.value,
    model: model.value,
    disableStreaming: disableStreaming.value,
    tools: tools.value,
    locale: locale.value.trim() || undefined,
    instructions: instructions.value.trim() || undefined,
    contextWindowSize: contextWindowSize.value,
    maxTokens: maxTokens.value,
    temperature: temperature.value,
    top_k: top_k.value,
    top_p: top_p.value,
    reasoning: reasoning.value,
    reasoningEffort: reasoningEffort.value,
    verbosity: verbosity.value,
    customOpts: Object.keys(customParams.value).length > 0 ? JSON.parse(JSON.stringify(customParams.value)) : undefined,
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
  model.value = llmManager.getDefaultChatModel(engine.value, false)
  onChangeModel()
}

const onChangeModel = () => {
  loadDefaults()
  save()
}

const onChangeTools = () => {
  tools.value = disableTools.value ? [] : null
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
    const topKValue = parseUserInput('TopK', top_k, 'int', 0, 100)
    const topPValue = parseUserInput('TopP', top_p, 'float', 0, 1)
    const reasoningValue = reasoning.value ?? undefined
    const reasoningEffortValue = reasoningEffort.value ?? undefined
    const verbosityValue = verbosity.value ?? undefined
    const customOptsValue = Object.keys(customParams.value).length > 0 ? JSON.parse(JSON.stringify(customParams.value)) : undefined

    // update chat
    props.chat.setEngineModel(engine.value, model.value)
    props.chat.disableStreaming = disableStreaming.value
    props.chat.tools = disableTools.value ? [] : (tools.value || null)
    props.chat.locale = locale.value.trim() || undefined,
    props.chat.instructions = instructions.value.trim() || undefined,
    props.chat.modelOpts = {
      contextWindowSize: contextWindowSizeValue,
      maxTokens: maxTokensValue,
      temperature: temperatureValue,
      top_k: topKValue,
      top_p: topPValue,
      reasoning: reasoningValue,
      reasoningEffort: reasoningEffortValue,
      verbosity: verbosityValue,
      customOpts: customOptsValue,
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
      llmManager.setChatModel(props.chat.engine, props.chat.model)
    }

    // debug
    //console.log(props.chat)

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
    await llmManager.loadModels('ollama')

    // and select
    model.value = name
    store.config.engines.ollama.model.chat = name
    store.saveSettings()

  }

}

</script>

<style scoped>

.model-settings {
  border-left: 1px solid var(--sidebar-border-color);
  background-color: var(--sidebar-bg-color);
  height: 100%;
  display: flex;
  flex-direction: column;

  .form {
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

    .form-subgroup {
      white-space: nowrap;
    }

    .list-with-actions {
      width: 100%;
    }

    .tools {
      display: flex;
      flex-direction: column;
      margin-top: 4px;
      gap: 4px;

      button {
        margin-left: 0;
        width: fit-content;
      };
    }

    textarea[name="instructions"] {
      flex: auto;
      resize: vertical;
    }
  }
}

</style>
