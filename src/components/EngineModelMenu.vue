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
      <!-- Default label item if provided -->
      <template v-if="props.defaultLabel">
        <div class="engine-item" @click="handleDefaultClick">
          <span class="engine-name">{{ props.defaultLabel }}</span>
        </div>
        <div class="separator">
          <hr />
        </div>
      </template>
      
      <template v-for="engine in availableEngines" :key="engine">

        <template v-if="llmManager.isFavoriteEngine(engine)">
          <div class="engine-item" v-for="model in getEngineModels(engine)" :key="model.id" @click="handleFavoriteClick(model.id)">
            <EngineLogo :engine="getFavoriteEngine(model.id)" :grayscale="isDarkTheme" :custom-label="false" class="engine-logo" />
            <span class="engine-name emphasis">{{ getFavoriteModel(model.id).name }}</span>
          </div>
          <div class="separator" v-if="llmManager.isFavoriteEngine(engine)">
            <hr />
          </div>
        </template>

        <div class="engine-item" :data-submenu-slot="`engine-${engine}`" v-else>
          <EngineLogo :engine="engine" :grayscale="isDarkTheme" :custom-label="false" class="engine-logo" />
          <span class="engine-name">{{ getEngineName(engine) }}</span>
        </div>

      </template>
    </template>

    <!-- Engine submenu templates -->
    <template v-for="engine in availableEngines" :key="`${engine}-submenu`" #[`engine-${engine}`]="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="model in getEngineModels(engine)" :key="model.id" class="model-item" @click="handleModelClick(engine, model.id)" >
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
import type { ChatModel } from 'multi-llm-ts'
import { computed, onMounted } from 'vue'
import useAppearanceTheme from '../composables/appearance_theme'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import { t } from '../services/i18n'
import { store } from '../services/store'
import ContextMenuPlus, { MenuPosition } from './ContextMenuPlus.vue'
import EngineLogo from './EngineLogo.vue'

// Props
interface Props {
  anchor: string
  position?: MenuPosition
  teleport?: boolean
  defaultLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
})

// Emits
interface Emits {
  close: []
  empty: []
  modelSelected: [engine: string | null, model: string | null]
}

const emit = defineEmits<Emits>()

// Reactive data
const llmManager = LlmFactory.manager(store.config)

const isDarkTheme = computed(() => {
  return useAppearanceTheme().isDark
})

const availableEngines = computed(() => {

  if (!store.workspace?.models) {
    return llmManager.getChatEngines().filter(engine => {
      return llmManager.isEngineReady(engine) && llmManager.hasChatModels(engine)
    }).filter((engine) => {
      return !llmManager.isFavoriteEngine(engine) || store.isFeatureEnabled('favorites')
    }).sort((a, b) => {
      if (llmManager.isFavoriteEngine(a)) return -1
      if (llmManager.isFavoriteEngine(b)) return 1
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

onMounted(() => {
  if (availableEngines.value.length === 0) {
    emit('empty')
  }
})

const getEngineName = (engine: string): string => {
  if (llmManager.isFavoriteEngine(engine)) {
    return t('common.favorites.name')
  }
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

const getFavoriteEngine = (favoriteId: string): string => {
  const fav = llmManager.getFavoriteModel(favoriteId)
  return fav.engine
}

const getFavoriteModel = (favoriteId: string): ChatModel => {
  const fav = llmManager.getFavoriteModel(favoriteId)
  return llmManager.getChatModel(fav.engine, fav.model)
} 

const handleFavoriteClick = (favorite: string) => {
  const fav = llmManager.getFavoriteModel(favorite)
  if (fav) {
    handleModelClick(fav.engine, fav.model)
  }
}

const handleDefaultClick = () => {
  emit('modelSelected', null, null)
  emit('close')
}

const handleModelClick = (engine: string, model: string) => {
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
  font-size: 14.5px;
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
  &.emphasis {
    font-weight: var(--font-weight-medium);
  }
}

.model-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0rem;
  cursor: pointer;
  font-size: 13.5px;
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
