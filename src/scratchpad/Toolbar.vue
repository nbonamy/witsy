<template>
  <div class="form">

    <div class="toolbar form-field">
    
      <button class="tool" @click="emitEvent('action', 'clear')">
        <FileIcon /><span>{{ t('common.clear') }}</span>
      </button>
      
      <button class="tool" @click="emitEvent('action', 'load')">
        <FolderOpenIcon /><span>{{ t('common.load') }}</span>
      </button>
      
      <button class="tool" @click="emitEvent('action', 'save')">
        <SaveIcon /><span>{{ t('common.save') }}</span>
      </button>
      
      <EngineSelect class="tool" v-model="engine" @change="onChangeEngine" />
      <ModelSelect class="tool" v-model="model" :engine="engine" @change="onChangeModel"/>
      
      <select class="tool" v-model="fontFamily" @change="onChangeFontFamily">
        <option value="serif">{{ t('scratchpad.fontFamily.serif') }}</option>
        <option value="sans-serif">{{ t('scratchpad.fontFamily.sansSerif') }}</option>
        <option value="monospace">{{ t('scratchpad.fontFamily.monospace') }}</option>
      </select>
      
      <select class="tool" v-model="fontSize" @change="onChangeFontSize">
        <option value="1">{{ t('scratchpad.fontSize.smaller') }}</option>
        <option value="2">{{ t('scratchpad.fontSize.small') }}</option>
        <option value="3">{{ t('scratchpad.fontSize.normal') }}</option>
        <option value="4">{{ t('scratchpad.fontSize.large') }}</option>
        <option value="5">{{ t('scratchpad.fontSize.larger') }}</option>
      </select>

    </div>

  </div>
</template>

<script setup lang="ts">

import { FileIcon, FileUpIcon, FolderOpenIcon, SaveIcon } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory from '../llms/llm'
import { t } from '../services/i18n'
import { store } from '../services/store'

// bus
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

export interface ToolbarAction {
  type: string,
  value: any
}

const props = defineProps({
  engine: String,
  model: String,
  fontFamily: String,
  fontSize: String
})

const engine = ref(null)
const model = ref(null)
const fontFamily = ref(null)
const fontSize = ref(null)

onMounted(() => {
  watch(() => props.engine || {}, () => engine.value = props.engine, { immediate: true })
  watch(() => props.model || {}, () => model.value = props.model, { immediate: true })
  watch(() => props.fontFamily || {}, () => fontFamily.value = props.fontFamily, { immediate: true })
  watch(() => props.fontSize || {}, () => fontSize.value = props.fontSize, { immediate: true })
})

const onChangeFontFamily = () => {
  emitEvent('action', { type: 'fontFamily', value: fontFamily.value })
}

const onChangeFontSize = () => {
  emitEvent('action', { type: 'fontSize', value: fontSize.value })
}

const onChangeEngine = () => {
  const llmManager = LlmFactory.manager(store.config)
  model.value = llmManager.getDefaultChatModel(engine.value, false)
  onChangeModel()
}

const onChangeModel = () => {
  emitEvent('action', { type: 'llm', value: { engine: engine.value, model: model.value }})
}

</script>


<style scoped>

.macos .form .toolbar {
  padding-left: 90px;
}

.windows .form .toolbar {
  padding-top: 32px;
}

.linux .form .toolbar {
  padding-top: 24px;
}

.form .toolbar {

  display: flex;
  flex-direction: row;
  height: 32px;
  margin: 0px;
  padding: 8px 16px;
  align-items: center;
  background-color: var(--dialog-header-bg-color);
  border-bottom: 1px solid var(--scratchpad-bars-border-color);
  -webkit-app-region: drag;
  gap: 10px;

  .tool {

    max-width: 128px;
    white-space: nowrap;
    padding: 6px 8px;
    font-size: 14.5px;
    margin: 0;

    &:enabled {
      -webkit-app-region: no-drag;
    }

    svg {
      position: relative;
      margin-right: 8px;
      top: 2px;
    }

  }

  select.tool {
    border-radius: 6px;
    font-size: 13.5px;
    padding-right: 0px;
    width: auto;
  }

}

</style>

