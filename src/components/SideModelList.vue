<template>
  <SideDrawer ref="sideDrawerRef">
    <template #header>
      {{ type === 'online' ? 'Add Online Models' : 'Install Local Models' }}
    </template>
    <template #content>
      <div class="form-field">
        <label>Model Provider</label>
        <EngineSelectPlus v-model="selectedEngine" :favorites="false" :filter="type" />
      </div>

      <div v-if="type === 'online'" class="form-field">
        <label>API Key</label>
        <InputObfuscated v-model="store.config.engines[selectedEngine].apiKey" />
      </div>

      <div class="form-field">
        <label>Enabled models</label>
        <template v-for="model in store.config.engines[selectedEngine].models.chat" :key="model">
          <label class="checkbox">
            <input 
              type="checkbox" 
              :checked="isModelEnabledInWorkspace(selectedEngine, model)" 
              @change="$emit('toggle-model', selectedEngine, model.id)" 
            />
            <span>{{ model.name }}</span>
          </label>
        </template>
      </div>
    </template>
  </SideDrawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../services/store'
import { ChatModel } from 'multi-llm-ts'
import { Workspace } from '../types/workspace'
import SideDrawer from './SideDrawer.vue'
import EngineSelectPlus from './EngineSelectPlus.vue'
import InputObfuscated from './InputObfuscated.vue'

interface Props {
  type: 'online' | 'local'
  workspace?: Workspace
}

const props = defineProps<Props>()

const defaultEngine = props.type === 'online' ? 'openai' : 'ollama'

const isModelEnabledInWorkspace = (engine: string, model: ChatModel) => {
  return props.workspace?.models?.some(m => m.engine == engine && m.model == model.id)
}

defineEmits<{
  'toggle-model': [engine: string, modelId: string]
}>()

const sideDrawerRef = ref<InstanceType<typeof SideDrawer>>()
const selectedEngine = ref(defaultEngine)

const show = () => {
  sideDrawerRef.value?.show()
}

const close = () => {
  sideDrawerRef.value?.close()
}

defineExpose({
  show,
  close
})
</script>

<style scoped>
.checkbox {
  cursor: pointer;
  margin: 0.5rem 1rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
  font-weight: normal !important;
}
</style>