<template>
  <SideDrawer ref="sideDrawerRef" @closed="$emit('closed')">
    <template #header>
      {{ type === 'online' ? 'Add Online Models' : 'Install Local Models' }}
    </template>
    <template #content>
      <div class="form-field">
        <label>Model Provider</label>
        <EngineSelectPlus v-model="selectedEngine" :favorites="false" :filter="type" />
      </div>

      <!-- <div v-if="type === 'online'" class="form-field">
        <label>API Key</label>
        <InputObfuscated v-model="store.config.engines[selectedEngine].apiKey" />
      </div> -->

      <div class="form-field">
        <div class="models-header">
          <label>Available models</label>
          <RotateCwIcon
            class="refresh-icon" 
            :class="{ spinning: isRefreshing }"
            @click="refreshModels"
          />
        </div>
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
import { RotateCwIcon } from 'lucide-vue-next'
import { ChatModel } from 'multi-llm-ts'
import { ref } from 'vue'
import Dialog from '../composables/dialog'
import LlmFactory from '../llms/llm'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Workspace } from '../types/workspace'
import EngineSelectPlus from './EngineSelectPlus.vue'
import SideDrawer from './SideDrawer.vue'
// import InputObfuscated from './InputObfuscated.vue'

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
  'closed': []
}>()

const sideDrawerRef = ref<InstanceType<typeof SideDrawer>>()
const selectedEngine = ref(defaultEngine)
const isRefreshing = ref(false)

const refreshModels = async (): Promise<boolean> => {
  if (isRefreshing.value) return false
  
  isRefreshing.value = true
  try {
    const llmManager = LlmFactory.manager(store.config)
    const success = await llmManager.loadModels(selectedEngine.value)
    if (!success) {
      Dialog.alert(t('common.errorModelRefresh'))
      return false
    }
    return true
  } finally {
    isRefreshing.value = false
  }
}

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
.models-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  width: 100%;
}

.refresh-icon {
  cursor: pointer;
  color: var(--text-color);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.refresh-icon:hover {
  opacity: 0.7;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

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