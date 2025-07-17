<template>
  <form class="docrepo-create large" @submit.prevent="onSave">
    <div class="header">
      <div class="title">{{ t('docRepo.create.title') }}</div>
      <div class="warning">
        <b>{{ t('common.warning') }}</b>: {{ t('docRepo.create.embeddingWarning') }}
      </div>
    </div>
    
    <div class="content">
      <div class="group name">
        <label>{{ t('common.name') }}</label>
        <input 
          type="text" 
          ref="nameInput" 
          v-model="name" 
          required 
        />
      </div>
      <EmbeddingSelector v-model:engine="engine" v-model:model="model" />
    </div>

    <div class="footer">
      <div class="buttons">
        <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
        <button type="submit" class="default">{{ t('common.create') }}</button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { t } from '../services/i18n'
import EmbeddingSelector from './EmbeddingSelector.vue'
import Dialog from '../composables/dialog'

// props
const props = defineProps<{
  mode: string
}>()

// emits
const emit = defineEmits<{
  cancel: []
  save: []
}>()

const nameInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const engine = ref('openai')
const model = ref('text-embedding-3-large')

// Watch for mode changes to reset and focus
watch(() => props.mode, (newMode) => {
  if (newMode === 'create') {
    name.value = t('docRepo.create.defaultName')
    nextTick(() => {
      nameInput.value?.focus()
      nameInput.value?.select()
    })
  }
}, { immediate: true })

const onSave = () => {
  // Validation
  if (!name.value || !engine.value || !model.value) {
    Dialog.alert(t('commands.editor.validation.requiredFields'))
    return
  }

  // Create repository
  window.api.docrepo.create(name.value, engine.value, model.value)
  emit('save')
}

const onCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
@import '../css/form.css';

.docrepo-create {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 2rem;
  gap: 1.5rem;
}

.header {
  .title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .warning {
    color: var(--warning-color);
    font-size: 0.9rem;
  }
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.footer {
  display: flex;
  justify-content: flex-end;
  
  .buttons {
    display: flex;
    gap: 0.5rem;
    
    button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      
      &.default {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
      }
      
      &:hover {
        opacity: 0.8;
      }
    }
  }
}

.group label {
  min-width: 150px;
}

* {
  color: var(--text-color);
}
</style>
