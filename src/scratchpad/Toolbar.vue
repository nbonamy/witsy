<template>
  <div class="toolbar">
    
    <button class="tool" @click="emitEvent('action', 'clear')"><BIconFileEarmark /><span>New</span></button>
    
    <button class="tool" @click="emitEvent('action', 'load')"><BIconFileArrowUp /><span>Load</span></button>
    
    <button class="tool" @click="emitEvent('action', 'save')"><BIconFileArrowDown /><span>Save</span></button>
    
    <!-- <button class="tool" @click="emitEvent('action', 'undo')" :disabled="!undoStack.length"><BIconArrowLeft /><span>Undo</span></button>
    <button class="tool" @click="emitEvent('action', 'redo')" :disabled="!redoStack.length"><BIconArrowRight /><span>Redo</span></button> -->
    
    <EngineSelect class="tool" v-model="engine" @change="onChangeEngine" />
    <ModelSelect class="tool" v-model="model" :engine="engine" @change="onChangeModel"/>
    
    <select class="tool" v-model="fontFamily" @change="onChangeFontFamily">
      <option value="serif">Serif</option>
      <option value="sans-serif">Sans-Serif</option>
      <option value="monospace">Monospace</option>
    </select>
    
    <select class="tool" v-model="fontSize" @change="onChangeFontSize">
      <option value="1">Smaller</option>
      <option value="2">Small</option>
      <option value="3">Normal</option>
      <option value="4">Large</option>
      <option value="5">Larger</option>
    </select>

  </div>
</template>

<script setup>

// components
import { ref, watch, onMounted } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'

// bus
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// load store
store.load()

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
  model.value = store.config.getActiveModel(engine.value)
  onChangeModel()
}

const onChangeModel = () => {
  emitEvent('action', { type: 'llm', engine: engine.value, model: model.value })
}

</script>

<style scoped>

.toolbar {
  display: flex;
  flex-direction: row;
  height: 32px;
  padding: 8px 16px 8px 100px;
  align-items: center;
  background-color: #e7e6e5;
  border-bottom: 1px solid #ccc;
  -webkit-app-region: drag;
  gap: 8px;

  .tool {

    max-width: 128px;
    white-space: nowrap;
    padding: 6px 8px;
    font-size: 11pt;
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
    border: 1px solid #cacaca;
    border-radius: 6px;
    font-size: 10pt;
    padding-right: 0px;
  }

}

</style>

