<template>
  
  <form class="docrepo-create large vertical" @submit.prevent>
  
    <div class="warning">
      <b>{{ t('common.warning') }}</b>: {{ t('docRepo.create.embeddingWarning') }}
    </div>
    
    <div class="group name">
      <label>{{ t('common.name') }}</label>
      <input type="text" ref="nameInput" v-model="name" required />
    </div>

    <EmbeddingSelector v-model:engine="engine" v-model:model="model" />

    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      <button type="submit" class="default" @click="onSave">{{ t('common.create') }}</button>
    </div>

  </form>

</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '../services/i18n'
import EmbeddingSelector from '../components/EmbeddingSelector.vue'
import Dialog from '../composables/dialog'

// emits
const emit = defineEmits([ 'cancel', 'save' ])

const nameInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const engine = ref('openai')
const model = ref('text-embedding-3-large')

const reset = () => {
  name.value = ''
  engine.value = 'openai'
  model.value = 'text-embedding-3-large'
}

const onSave = () => {
  // Validation
  if (!name.value || !engine.value || !model.value) {
    Dialog.alert(t('commands.editor.validation.requiredFields'))
    return
  }

  // Create repository
  const id = window.api.docrepo.create(name.value, engine.value, model.value)
  emit('save', id)
  reset()
}

const onCancel = () => {
  emit('cancel')
  reset()
}

</script>

<style scoped>
@import '../../css/form.css';

.docrepo-create {
  padding: 2rem 17%;
}

.warning {
  width: 100%;
  color: var(--warning-color);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
}

</style>
