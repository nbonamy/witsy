<template>
  <ContextMenuPlus 
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    :hover-highlight="false"
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
            <span class="engine-name emphasis">{{ getFavoriteModel(model.id)?.name || model.id }}</span>
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
      <div v-for="model in getEngineModels(engine)" :key="model.id" class="item model-item" @click="handleModelClick(engine, model.id)" >
        {{ model.name }}
      </div>
    </template>

    <template v-for="engine in availableEngines" :key="`${engine}-footer`" v-slot:[`engine-${engine}Footer`]="{ withFilter }">
      <div @click="refreshModels(engine)" v-if="!store.workspace?.models">
        <SpinningIcon class="icon refresh" :spinning="refreshing" /> {{ t('prompt.menu.models.reload') }}
      </div>
    </template>

  </ContextMenuPlus>

</template>

<script setup lang="ts">
import type { ChatModel } from 'multi-llm-ts'
import { computed, nextTick, onMounted, ref } from 'vue'
import useAppearanceTheme from '../composables/appearance_theme'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import { t } from '../services/i18n'
import { store } from '../services/store'
import ContextMenuPlus, { MenuPosition } from './ContextMenuPlus.vue'
import EngineLogo from './EngineLogo.vue'
import SpinningIcon from './SpinningIcon.vue'

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

const refreshing = ref(false)

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
    console.warn('EngineModelMenu: No available engines found')
    console.warn('EngineModelMenu: All engines:', llmManager.getChatEngines())
    console.warn('EngineModelMenu: Workspace models:', store.workspace?.models)
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

const refreshModels = async (engine: string) => {
  refreshing.value = true
  await nextTick()
  await llmManager.loadModels(engine)
  refreshing.value = false
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
  display: block;
  padding: 0.75rem 1rem;
  font-weight: var(--font-weight-medium);
}

.icon.refresh {
  width: var(--icon-md);
  height: var(--icon-md);
}

</style>
