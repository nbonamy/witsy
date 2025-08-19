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
import { engineNames } from '../llms/base'

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
  // If no workspace is defined, show all engines
  if (!store.workspace?.models) {
    return llmManager.getChatEngines().filter(engine => {
      return llmManager.isEngineReady(engine) && llmManager.hasChatModels(engine) && !llmManager.isFavoriteEngine(engine)
    }).sort((a, b) => {
      const nameA = llmManager.getEngineName(a).toLowerCase()
      const nameB = llmManager.getEngineName(b).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  // Filter engines based on workspace favorite models
  const workspaceEngines = [...new Set(store.workspace.models.map(model => model.engine))]
  return workspaceEngines.filter(engine => {
    return llmManager.isEngineReady(engine) && llmManager.hasChatModels(engine) && !llmManager.isFavoriteEngine(engine)
  }).sort((a, b) => {
    const nameA = llmManager.getEngineName(a).toLowerCase()
    const nameB = llmManager.getEngineName(b).toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

const getEngineName = (engine: string): string => {
  const name = llmManager.getEngineName(engine)
  return engineNames[name] ?? name
}

const getEngineModels = (engine: string): ChatModel[] => {
  const allModels = llmManager.getChatModels(engine)
  
  // If no workspace is defined, show all models
  if (!store.workspace?.models) {
    return allModels
  }

  // Filter models based on workspace favorite models
  const workspaceModelIds = store.workspace.models
    .filter(model => model.engine === engine)
    .map(model => model.model)
  
  return allModels.filter(model => workspaceModelIds.includes(model.id))
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
  cursor: pointer;
  font-size: 11pt;
  white-space: nowrap;
  overflow-x: clip;
  text-overflow: ellipsis;
}

.engine-logo {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.engine-name {
  flex: 1;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0rem;
  cursor: pointer;
  font-size: 10pt;
}

.model-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  gap: 0.125rem;
}

.model-name {
  font-weight: var(--font-weight-medium);
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
