<template>
  <div class="form-field" v-if="isContextWindowSupported">
    <label>{{ t('modelSettings.contextWindowSize') }}</label>
    <input type="text" name="contextWindowSize" v-model="contextWindowSize" :placeholder="t('modelSettings.defaultModelValue')" @change="emitUpdate" />
  </div>
  <div class="form-field" v-if="isMaxTokensSupported">
    <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
    <input type="text" name="maxTokens" v-model="maxTokens" :placeholder="t('modelSettings.defaultModelValue')" @change="emitUpdate" />
  </div>
  <div class="form-field" v-if="isTemperatureSupported">
    <label>{{ t('modelSettings.temperature') }}</label>
    <input type="text" name="temperature" v-model="temperature" :placeholder="t('modelSettings.defaultModelValue')" @change="emitUpdate" />
  </div>
  <div class="form-field" v-if="isTopKSupported">
    <label>{{ t('modelSettings.topK') }}</label>
    <input type="text" name="top_k" v-model="top_k" :placeholder="t('modelSettings.defaultModelValue')" @change="emitUpdate" />
  </div>
  <div class="form-field" v-if="isTopPSupported">
    <label>{{ t('modelSettings.topP') }}</label>
    <input type="text" name="top_p" v-model="top_p" :placeholder="t('modelSettings.defaultModelValue')" @change="emitUpdate" />
  </div>
  <template v-if="isReasoningFlagSupported">
    <div class="form-field">
      <label>{{ t('modelSettings.extendedThinking') }}</label>
      <select name="reasoning" v-model="reasoning" @change="emitUpdate">
        <option :value="undefined">{{ t('common.default') }}</option>
        <option :value="false">{{ t('common.disabled') }}</option>
      </select>
    </div>
    <div class="form-field">
      <label>{{ t('modelSettings.reasoningBudget') }}</label>
      <input name="reasoningBudget" v-model="reasoningBudget" @change="emitUpdate" />
    </div>
  </template>
  <div class="form-field" v-if="isReasoningEffortSupported">
    <label>{{ t('modelSettings.reasoningEffort') }}</label>
    <select name="reasoningEffort" v-model="reasoningEffort" @change="emitUpdate">
      <option :value="undefined">{{ t('common.default') }}</option>
      <option value="low">{{ t('common.low') }}</option>
      <option value="medium">{{ t('common.medium') }}</option>
      <option value="high">{{ t('common.high') }}</option>
    </select>
  </div>
  <div class="form-field" v-if="isVerbositySupported">
    <label>{{ t('modelSettings.verbosity') }}</label>
    <select name="verbosity" v-model="verbosity" @change="emitUpdate">
      <option :value="undefined">{{ t('common.default') }}</option>
      <option value="low">{{ t('common.low') }}</option>
      <option value="medium">{{ t('common.medium') }}</option>
      <option value="high">{{ t('common.high') }}</option>
    </select>
  </div>
  <div class="form-field" v-if="isThinkingBudgetSupported">
    <label>{{ t('modelSettings.thinkingBudget') }}</label>
    <input name="thinkingBudget" v-model="thinkingBudget" @change="emitUpdate" />
  </div>
  <div class="form-field" v-if="isThinkSupported">
    <label>{{ t('modelSettings.reasoning') }}</label>
    <select name="think" v-model="think" @change="emitUpdate">
      <option :value="undefined">{{ t('common.default') }}</option>
      <option value="false">{{ t('common.disabled') }}</option>
      <option value="low">{{ t('common.low') }}</option>
      <option value="medium">{{ t('common.medium') }}</option>
      <option value="high">{{ t('common.high') }}</option>
    </select>
  </div>

  <div class="form-field custom" v-if="modelHasCustomParams">
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

  <VariableEditor ref="editor" id="model-variable-editor" title="designStudio.variableEditor.title" :variable="selectedParam" @save="onSaveParam" />

</template>

<script setup lang="ts">
import { LlmModelOpts, LlmOllamaThink, LlmReasoningEffort, LlmVerbosity } from 'multi-llm-ts'
import { computed, ref, watch } from 'vue'
import Dialog from '@renderer/utils/dialog'
import LlmFactory from '@services/llms/llm'
import VariableEditor from '@screens/VariableEditor.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import VariableTable from './VariableTable.vue'

const props = defineProps<{
  engine: string
  model: string
  modelValue?: LlmModelOpts
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LlmModelOpts | undefined]
}>()

const llmManager = LlmFactory.manager(store.config)
const editor = ref<InstanceType<typeof VariableEditor>>()

// Local state for model options
const contextWindowSize = ref<number | undefined>(undefined)
const maxTokens = ref<number | undefined>(undefined)
const temperature = ref<number | undefined>(undefined)
const top_k = ref<number | undefined>(undefined)
const top_p = ref<number | undefined>(undefined)
const reasoning = ref<boolean | undefined>(undefined)
const reasoningBudget = ref<number | undefined>(undefined)
const reasoningEffort = ref<LlmReasoningEffort | undefined>(undefined)
const verbosity = ref<LlmVerbosity | undefined>(undefined)
const thinkingBudget = ref<number | undefined>(undefined)
const think = ref<LlmOllamaThink | undefined>(undefined)
const customParams = ref<Record<string, any>>({})
const selectedParam = ref<{ key: string, value: any } | null>(null)

// Computed properties for field support
const isContextWindowSupported = computed(() => props.engine === 'ollama')
const isMaxTokensSupported = computed(() => true)
const isTemperatureSupported = computed(() => true)
const isTopKSupported = computed(() => props.engine !== 'groq' && props.engine !== 'mistralai' && props.engine !== 'cerebras')
const isTopPSupported = computed(() => true)
const isReasoningFlagSupported = computed(() => props.engine === 'anthropic' || props.engine === 'mock')
const isReasoningEffortSupported = computed(() => props.engine === 'openai')
const isVerbositySupported = computed(() => props.engine === 'openai' && props.model.startsWith('gpt-5'))
const isThinkingBudgetSupported = computed(() => props.engine === 'google')
const isThinkSupported = computed(() => props.engine === 'ollama')
const modelHasCustomParams = computed(() => llmManager.isCustomEngine(props.engine))

// Watch for modelValue changes from parent
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    contextWindowSize.value = newValue.contextWindowSize
    maxTokens.value = newValue.maxTokens
    temperature.value = newValue.temperature
    top_k.value = newValue.top_k
    top_p.value = newValue.top_p
    reasoning.value = newValue.reasoning
    reasoningBudget.value = newValue.reasoningBudget
    reasoningEffort.value = newValue.reasoningEffort
    verbosity.value = newValue.verbosity
    thinkingBudget.value = newValue.thinkingBudget
    think.value = newValue.think
    customParams.value = newValue.customOpts || {}
  } else {
    // Reset to defaults
    contextWindowSize.value = undefined
    maxTokens.value = undefined
    temperature.value = undefined
    top_k.value = undefined
    top_p.value = undefined
    reasoning.value = undefined
    reasoningBudget.value = undefined
    reasoningEffort.value = undefined
    verbosity.value = undefined
    thinkingBudget.value = undefined
    think.value = undefined
    customParams.value = {}
  }
}, { immediate: true, deep: true })

const parseUserInput = (name: string, ref: any, type: string, min?: number, max?: number): any => {
  // Easy stuff
  if (ref.value === undefined || ref.value === null || ref.value === '') return undefined
  const value = type === 'float' ? parseFloat(ref.value) : parseInt(ref.value)
  if (isNaN(value)) {
    ref.value = undefined
    Dialog.show({
      title: t('modelSettings.errors.invalid.title', { name }),
      text: t('modelSettings.errors.invalid.mustBeNumber'),
      confirmButtonText: t('common.ok'),
    })
    throw new Error(`Invalid ${name}`)
  }

  // Check min and max
  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    ref.value = undefined
    Dialog.show({
      title: t('modelSettings.errors.invalid.title', { name }),
      text:
        min !== undefined && max !== undefined
          ? t('modelSettings.errors.invalid.mustBeBetween', { min, max })
          : min !== undefined
            ? t('modelSettings.errors.invalid.mustBeGreaterThan', { min })
            : t('modelSettings.errors.invalid.mustBeLessThan', { max }),
      confirmButtonText: t('common.ok'),
    })
    throw new Error(`Invalid ${name}`)
  }

  // All good
  return value
}

const emitUpdate = () => {
  try {
    // Parse and validate numeric values
    const minMaxTokens = props.engine === 'ollama' ? -2 : 1
    const maxTokensValue = parseUserInput('Max Completion Tokens', maxTokens, 'int', minMaxTokens)
    const contextWindowSizeValue = parseUserInput('Context Window Size', contextWindowSize, 'int', 1)
    const temperatureValue = parseUserInput('Temperature', temperature, 'float', 0, 2)
    const topKValue = parseUserInput('TopK', top_k, 'int', 0, 100)
    const topPValue = parseUserInput('TopP', top_p, 'float', 0, 1)
    const reasoningValue = reasoning.value ?? undefined
    const reasoningBudgetValue = parseUserInput('Reasoning Budget', reasoningBudget, 'int', 1024)
    const reasoningEffortValue = reasoningEffort.value ?? undefined
    const verbosityValue = verbosity.value ?? undefined
    const thinkingBudgetValue = parseUserInput('Thinking Budget', thinkingBudget, 'int', 0)

    // @ts-expect-error safe conversion
    const thinkValue = think.value === 'false' ? false : (think.value ?? undefined)

    // Build and emit modelOpts
    const modelOpts: LlmModelOpts = {
      contextWindowSize: contextWindowSizeValue,
      maxTokens: maxTokensValue,
      temperature: temperatureValue,
      top_k: topKValue,
      top_p: topPValue,
      reasoning: reasoningValue,
      reasoningBudget: reasoningBudgetValue,
      reasoningEffort: reasoningEffortValue,
      verbosity: verbosityValue,
      thinkingBudget: thinkingBudgetValue,
      think: thinkValue,
      customOpts: Object.keys(customParams.value).length > 0 ? customParams.value : undefined,
    }

    // Remove undefined values
    Object.keys(modelOpts).forEach(key => {
      if (modelOpts[key as keyof LlmModelOpts] === undefined) {
        delete modelOpts[key as keyof LlmModelOpts]
      }
    })

    emit('update:modelValue', Object.keys(modelOpts).length > 0 ? modelOpts : {})
  } catch (error) {
    console.error('Error validating model options:', error)
  }
}

// Custom params handlers
const onSelectParam = (key: string) => {
  selectedParam.value = { key, value: customParams.value[key] }
}

const onAddParam = () => {
  selectedParam.value = { key: '', value: '' }
  editor.value?.show()
}

const onEditParam = (key: string) => {
  selectedParam.value = { key, value: customParams.value[key] }
  editor.value?.show()
}

const onDelParam = () => {
  if (selectedParam.value) {
    delete customParams.value[selectedParam.value.key]
    customParams.value = { ...customParams.value }
  }
  emitUpdate()
}

const onSaveParam = (param: { key: string, value: string }) => {
  if (param.key.length) {
    if (param.key !== selectedParam.value?.key) {
      delete customParams.value[selectedParam.value!.key]
    }
    let value: any = param.value
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (!isNaN(value)) value = parseFloat(value)
    customParams.value[param.key] = value
    customParams.value = { ...customParams.value }
  }
  emitUpdate()
}
</script>
