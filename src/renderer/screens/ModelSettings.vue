<template>
  <div class="model-settings">
    <div class="header">
      <div class="title">{{ t('modelSettings.advancedSettings') }}</div>
      <ButtonIcon class="close" @click="$emit('close')">
        <SlidersHorizontalIcon />
      </ButtonIcon>
    </div>
    <div class="form form-vertical">
      
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <EngineModelSelect
          :engine="engine"
          :model="model"
          css-classes="model-settings"
          @modelSelected="onModelSelected"
        />
      </div>
      
      <div class="form-field">
        <label>{{ t('modelSettings.instructions') }}</label>
        <textarea name="instructions" v-model="instructions" :placeholder="t('modelSettings.instructionsPlaceholder')" rows="4" @change="save"></textarea>
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

      <ModelAdvancedSettings
        v-if="showAdvanced"
        v-model="props.chat.modelOpts"
        :engine="engine"
        :model="model"
        @update:modelValue="save"
      />

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

  </div>

</template>

<script setup lang="ts">

import { SlidersHorizontalIcon } from 'lucide-vue-next'
import { Ollama } from 'ollama/dist/browser.cjs'
import { computed, onMounted, ref, watch } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import EngineModelSelect from '../components/EngineModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import ModelAdvancedSettings from '../components/ModelAdvancedSettings.vue'
import Dialog from '../utils/dialog'
import LlmFactory, { areAllToolsEnabled, areToolsDisabled, ILlmManager } from '../services/llms/llm'
import Chat from '../../models/chat'
import ToolSelector from '../screens/ToolSelector.vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { ModelDefaults } from 'types/config'
import { anyDict } from 'types/index'

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

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
})

const emit = defineEmits(['close'])

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
    (props.chat?.modelOpts && Object.keys(props.chat.modelOpts).length > 0)
  )
})

const canCreateOllamaModel = computed(() => {
  const modelOpts = props.chat?.modelOpts
  return (
    modelOpts?.contextWindowSize !== undefined ||
    modelOpts?.maxTokens !== undefined ||
    modelOpts?.temperature !== undefined ||
    modelOpts?.top_k !== undefined ||
    modelOpts?.top_p !== undefined
  )
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
  }, { deep: true, immediate: true })
})

const onCustomizeTools = () => {
  selector.value.show(tools.value)
}

const onSaveTools = (selected: string[]) => {
  tools.value = selected
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
  save()
}

const loadDefaults = () => {
  const defaults = store.config.llm.defaults.find(d => d.engine === engine.value && d.model === model.value)
  if (defaults) {
    disableStreaming.value = defaults.disableStreaming
    disableTools.value = areToolsDisabled(defaults.tools)
    tools.value = defaults.tools
    locale.value = defaults.locale || ''
    instructions.value = defaults.instructions || ''
    props.chat.modelOpts = defaults.modelOpts
  } else {
    disableStreaming.value = false
    disableTools.value = false
    tools.value = null
    locale.value = ''
    instructions.value = ''
    props.chat.modelOpts = {}
  }
}

const saveAsDefaults = () => {
  clearDefaults()
  const modelDefaults: ModelDefaults = {
    engine: engine.value,
    model: model.value,
    disableStreaming: disableStreaming.value,
    tools: tools.value,
    locale: locale.value.trim() || undefined,
    instructions: instructions.value.trim() || undefined,
    modelOpts: props.chat.modelOpts,
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

const onModelSelected = (newEngine: string | null, newModel: string | null) => {
  if (newEngine && newModel) {
    engine.value = newEngine
    model.value = newModel
  }
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

  // update chat (modelOpts are already updated by ModelAdvancedSettings via v-model)
  props.chat.setEngineModel(engine.value, model.value)
  props.chat.disableStreaming = disableStreaming.value
  props.chat.tools = disableTools.value ? [] : (tools.value || null)
  props.chat.locale = locale.value.trim() || undefined
  props.chat.instructions = instructions.value.trim() || undefined
  props.chat.modelOpts = Object.keys(props.chat?.modelOpts ?? {}).length > 0 ? props.chat.modelOpts : undefined

  // special case
  if (!props.chat.hasMessages()) {
    llmManager.setChatModel(props.chat.engine, props.chat.model)
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
    const modelOpts = props.chat.modelOpts || {}
    await ollama.create({
      model: name,
      from: model.value,
      parameters: {
        num_ctx: modelOpts.contextWindowSize,
        num_predict: modelOpts.maxTokens,
        temperature: modelOpts.temperature,
        top_k: modelOpts.top_k,
        top_p: modelOpts.top_p,
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

<style>

.context-menu.model-settings {
  max-width: unset;
  width: 16.75rem;
  border-radius: 0rem;
}


</style>

<style scoped>

.model-settings {
  border-top: 1px solid var(--sidebar-border-color);
  border-left: 1px solid var(--sidebar-border-color);
  background-color: var(--sidebar-bg-color);
  display: flex;
  flex-direction: column;

  .header {
    padding: 1rem;
    display: flex;
    align-items: center;
  }

  .close {
    margin-left: auto;
    cursor: pointer;
  }

  .title {
    font-size: 11pt;
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
  }

  .form {
    padding: 1rem;
    padding-top: 0rem;
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

    .engine-model-select {
      width: calc(100% - 2rem);
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
