<template>
  <ModalDialog 
    id="mcp-tool-selector" 
    type="window" 
    ref="dialog"
    @save="onSave"
    width="44rem"
  >
    <template #header>
      {{ t('mcp.tools') }}
    </template>
    
    <template #body>
      <div class="tool-selector">
        <div class="tool-list">
          <div v-for="tool in tools" :key="tool.name" class="tool-item">
            <input type="checkbox" :value="tool.name" v-model="selectedTools" />
            <span class="tool-info" @click="onClickInfo">
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-description">{{ tool.description }}</span>
            </span>
          </div>
        </div>
        <div v-if="!tools.length" class="empty-state">
          {{ t('mcp.noTools') }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="selection-summary">
        {{ getSelectionSummary() }}
      </div>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary">{{ t('common.cancel') }}</button>
        <button name="none" @click="selectNone" class="secondary">{{ t('common.selectNone') }}</button>
        <button name="all" @click="selectAll" class="secondary">{{ t('common.selectAll') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, watch } from 'vue'
import { t } from '../services/i18n'
import { ToolSelection } from '../types/llm'
import { McpTool } from '../types/mcp'
import ModalDialog from './ModalDialog.vue'

const props = defineProps<{
  tools: McpTool[]
  toolSelection: ToolSelection
}>()

const emit = defineEmits<{
  save: [selection: ToolSelection]
  cancel: []
}>()

const dialog = ref<InstanceType<typeof ModalDialog>>()
const selectedTools = ref<string[]>([])

// Initialize selected tools based on toolSelection prop
const initializeSelection = () => {
  if (props.toolSelection === null) {
    // All tools selected
    selectedTools.value = props.tools.map(tool => tool.name)
  } else {
    // Specific tools selected (could be empty array)
    selectedTools.value = Array.isArray(props.toolSelection) ? [...props.toolSelection] : []
  }
}

// Watch for changes to toolSelection prop
watch(() => props.toolSelection, initializeSelection, { immediate: true })
watch(() => props.tools, initializeSelection)

const onClickInfo = (ev: MouseEvent) => {
  const el = ev.target as HTMLElement
  el.parentElement.closest('.tool-item').querySelector('input').click()
}

const selectAll = () => {
  selectedTools.value = props.tools.map(tool => tool.name)
}

const selectNone = () => {
  selectedTools.value = []
}

const getSelectionSummary = () => {
  const total = props.tools.length
  const selected = selectedTools.value.length
  
  if (selected === total && total > 0) {
    return t('common.allSelected')
  } else if (selected === 0) {
    return t('common.noneSelected')
  } else {
    return t('common.selectedCount', { selected, total })
  }
}

const getToolSelection = (): ToolSelection => {
  // If all tools are selected, return null (means all enabled)
  if (selectedTools.value.length === props.tools.length && props.tools.length > 0) {
    return null
  }
  // Otherwise return the specific array of selected tools
  return [...selectedTools.value]
}

const onSave = () => {
  const selection = getToolSelection()
  emit('save', selection)
  dialog.value?.close()
}

const onCancel = () => {
  emit('cancel')
  dialog.value?.close()
}

const show = () => {
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

defineExpose({ show, close })

</script>

<style scoped>

.tool-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selection-summary {
  position: absolute;
  left: 2.5rem;
  color: var(--dimmed-text-color);
  padding: 0.5rem 0;
}

.tool-list {
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
  padding-bottom: 2rem;
}

.tool-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  width: 100%;
}

.tool-checkbox input[type="checkbox"] {
  flex-shrink: 0;
}

.tool-info {
  display: flex;
  flex-direction: column;
  padding-right: 1rem;
  gap: 0.25rem;
  min-width: 0;
}

.tool-name {
  font-weight: 600;
  color: var(--text-color);
}

.tool-description {
  color: var(--faded-text-color);
  max-height: 5lh;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  color: var(--faded-text-color);
  padding: 2rem;
  font-style: italic;
}

</style>