<template>
  <div class="engine-model-select" ref="selectRef">
    <div 
      class="select-box"
      @click="toggleDropdown"
      :class="{ 'open': isOpen }"
      :id="selectId"
    >
      <div class="content">
        <EngineLogo 
          :engine="engine" 
          :grayscale="false" 
          :custom-label="false" 
          class="engine-logo" 
        />
        <div class="names">
          <span class="engine-name">{{ getEngineName(engine) }}</span>&nbsp;
          <span class="model-name">{{ getModelName(model) }}</span>
        </div>
      </div>
      <ChevronDownIcon class="chevron" :class="{ 'rotated': isOpen }" />
    </div>
    
    <EngineModelMenu
      v-if="isOpen"
      :anchor="`#${selectId}`"
      :position="'below'"
      :teleport="true"
      @close="closeDropdown"
      @modelSelected="onModelSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next'
import { nextTick, ref } from 'vue'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'
import EngineModelMenu from './EngineModelMenu.vue'

interface Props {
  engine: string
  model: string
}

const props = defineProps<Props>()

interface Emits {
  modelSelected: [engine: string, model: string]
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

const onModelSelected = (engine: string, model: string) => {
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
  border: 1px solid var(--color-border);
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

.engine-logo {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.engine-name {
  font-weight: var(--font-weight-medium);
}

.chevron {
  width: 1rem;
  height: 1rem;
  color: var(--color-text-secondary);
  fill: var(--color-text-secondary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron.rotated {
  transform: rotate(180deg);
}
</style>