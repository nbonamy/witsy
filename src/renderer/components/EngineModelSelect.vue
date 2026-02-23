<template>
  <div class="engine-model-select" ref="selectRef">
    <div 
      class="select-box"
      @click="toggleDropdown"
      :class="{ 'open': isOpen }"
      :id="selectId"
    >
      <div class="content">
        <template v-if="!engine || !model">
          <span class="default-label">{{ defaultLabel }}</span>
        </template>
        <template v-else>
          <EngineLogo 
            :engine="engine" 
            :custom-label="false" 
            class="engine-logo" 
          />
          <div class="names">
            <span class="engine-name">{{ getEngineName(engine) }}</span>&nbsp;
            <span class="model-name">{{ getModelName(model) }}</span>
          </div>
        </template>
      </div>
      <ChevronDownIcon class="chevron" :class="{ 'rotated': isOpen }" />
    </div>
    
    <EngineModelMenu
      v-if="isOpen"
      :anchor="`#${selectId}`"
      :position="position"
      :teleport="true"
      :defaultLabel="defaultLabel"
      :css-classes="cssClasses"
      :favorites="favorites"
      @close="closeDropdown"
      @modelSelected="onModelSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next'
import { nextTick, ref } from 'vue'
import { engineNames } from '@services/llms/consts'
import LlmFactory from '@services/llms/llm'
import { store } from '@services/store'
import { MenuPosition } from './ContextMenuPlus.vue'
import EngineLogo from './EngineLogo.vue'
import EngineModelMenu from './EngineModelMenu.vue'

interface Props {
  engine?: string
  model?: string
  favorites?: boolean
  position?: MenuPosition
  defaultLabel?: string
  cssClasses?: string
}

const props = withDefaults(defineProps<Props>(), {
  engine: '',
  model: '',
  favorites: true,
  position: 'below',
})

interface Emits {
  modelSelected: [engine: string | null, model: string | null]
}

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const selectRef = ref<HTMLElement>()
const selectId = `engine-model-select-${Math.random().toString(36).substr(2, 9)}`
const llmManager = LlmFactory.manager(store.config)

const getEngineName = (engine: string): string => {
  const name = llmManager.getEngineName(engine)
  return engineNames[name] ?? name
}

const getModelName = (modelId: string): string => {
  if (!props.engine || !modelId) return ''
  
  const models = llmManager.getChatModels(props.engine)
  const model = models.find(m => m.id === modelId)
  return model?.name || modelId
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  
  if (isOpen.value) {
    // Set the context menu width to match the select box after it's rendered
    nextTick(() => {
      const selectElement = document.getElementById(selectId)
      if (selectElement) {
        const selectWidth = selectElement.getBoundingClientRect().width
        const contextMenu = document.querySelector('.context-menu') as HTMLElement
        if (contextMenu) {
          contextMenu.style.width = `${selectWidth}px`
          contextMenu.style.maxWidth = `${selectWidth}px`
        }
      }
    })
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const onModelSelected = (engine: string | null, model: string | null) => {
  emit('modelSelected', engine, model)
  closeDropdown()
}

</script>

<style scoped>
.engine-model-select {
  position: relative;
}

.select-box {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--control-border-color);
  border-radius: var(--control-border-radius);
  background-color: var(--control-bg-color);
  cursor: pointer;
}

.content {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.content span {
  margin: 0 !important;
  padding: 0 !important;
}

.engine-logo {
  width: var(--icon-lg);
  height: var(--icon-lg);
  flex-shrink: 0;
}

.engine-name {
  font-weight: var(--font-weight-medium);
}

.default-label {
  font-weight: var(--font-weight-medium);
  color: var(--dimmed-text-color);
}

.chevron {
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--dimmed-text-color);
  fill: var(--dimmed-text-color);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron.rotated {
  transform: rotate(180deg);
}
</style>