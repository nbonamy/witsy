<template>
  <div class="panel" :class="variant">
    <div class="panel-header">
      <label>
        <slot name="header"></slot>
        <div class="tag info" v-if="models.length">{{ models.length }}</div>
      </label>
    </div>

    <div class="panel-body models" v-if="models.length">
      <div class="panel-item model" v-for="model in models" :key="model.id">
        <div class="logo"><EngineLogo :engine="model.engine" /></div>
        <div class="info">
          <div class="text">{{ getModelName(model) }}</div>
          <div class="subtext">{{ getEngineName(model.engine) }}</div>
        </div>
        <div class="actions">
          <div class="icon"><XIcon @click="$emit('remove-model', model)"/></div>
        </div>
      </div>
    </div>
    <div class="panel-empty" v-else>
      <slot name="empty">No models available.</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XIcon } from 'lucide-vue-next'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'

interface Model {
  id: string
  engine: string
  model: string
}

defineProps<{
  models: Model[]
  variant?: string
}>()

defineEmits<{
  'remove-model': [model: Model]
}>()

const llmManager = LlmFactory.manager(store.config)

const getModelName = (model: Model) => {
  return llmManager.getChatModel(model.engine, model.model).name
}

const getEngineName = (engine: string) => {
  return engineNames[engine]
}
</script>

<style scoped>
.panel {
  border: none;
}

.models {
  .model {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;

    .logo {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
}
</style>