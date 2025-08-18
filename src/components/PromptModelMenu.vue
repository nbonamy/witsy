<template>
  <ContextMenuPlus 
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    @close="$emit('close')"
  >
    <!-- Main menu template -->
    <template #default>
      <div v-for="engine in availableEngines" :key="engine" class="engine-item" :data-submenu-slot="`engine-${engine}`">
        <EngineLogo :engine="engine" :grayscale="false" :custom-label="false" class="engine-logo" />
        <span class="engine-name">{{ getEngineName(engine) }}</span>
      </div>
    </template>

    <!-- Engine submenu templates -->
    <template v-for="engine in availableEngines" :key="`${engine}-submenu`" #[`engine-${engine}`]="{ withFilter }">
      {{ withFilter(true) }}
      <div 
        v-for="model in getEngineModels(engine)" 
        :key="model.id" 
        class="model-item"
        @click="handleModelClick(engine, model.id)"
      >
        <div class="model-info">
          <div class="model-name">{{ model.name }}</div>
          <div class="model-id">{{ model.id }}</div>
        </div>
        <div class="model-capabilities">
          <span v-if="model.capabilities?.vision" class="capability" title="Vision">👁️</span>
          <span v-if="model.capabilities?.tools" class="capability" title="Tools">🔧</span>
          <span v-if="model.capabilities?.reasoning" class="capability" title="Reasoning">🧠</span>
        </div>
      </div>
    </template>
  </ContextMenuPlus>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ContextMenuPlus from './ContextMenuPlus.vue'
import EngineLogo from './EngineLogo.vue'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'
import type { ChatModel } from 'multi-llm-ts'

// Props
interface Props {
  anchor: string
  position?: 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'
  teleport?: boolean
  chat?: any
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
})

// Emits
interface Emits {
  close: []
  modelSelected: [engine: string, model: string]
}

const emit = defineEmits<Emits>()

// Reactive data
const llmManager = LlmFactory.manager(store.config)

// Computed properties
const availableEngines = computed(() => {
  return llmManager.getChatEngines().filter(engine => {
    return llmManager.isEngineReady(engine) && llmManager.hasChatModels(engine) && !llmManager.isFavoriteEngine(engine)
  }).sort((a, b) => {
    const nameA = llmManager.getEngineName(a).toLowerCase()
    const nameB = llmManager.getEngineName(b).toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

const getEngineName = (engine: string): string => {
  return llmManager.getEngineName(engine)
}

const getEngineModels = (engine: string): ChatModel[] => {
  return llmManager.getChatModels(engine)
}

// Methods
const handleModelClick = (engine: string, model: string) => {
  // Update LLM manager settings
  llmManager.setChatModel(engine, model)
  
  // Update chat if provided
  if (props.chat) {
    props.chat.setEngineModel(engine, model)
  }
  
  emit('modelSelected', engine, model)
  emit('close')
}
</script>

<style scoped>
.engine-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 11pt;
  white-space: nowrap;
  overflow-x: clip;
  text-overflow: ellipsis;
  color: var(--context-menu-text-color);
}

.engine-item:hover {
  background-color: var(--context-menu-selected-bg-color);
}

.engine-logo {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.engine-name {
  flex: 1;
  text-transform: capitalize;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 10pt;
  color: var(--context-menu-text-color);
}

.model-item:hover {
  background-color: var(--context-menu-selected-bg-color);
}

.model-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  gap: 0.125rem;
}

.model-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-id {
  display: none;
  opacity: 0.6;
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-capabilities {
  display: none;
  gap: 0.25rem;
  flex-shrink: 0;
}

.capability {
  font-size: 0.75em;
  opacity: 0.7;
}

.capability:hover {
  opacity: 1;
}
</style>
