<template>
  <ModalDialog id="docrepo-create" ref="dialog" @save="onSave" width="32rem">
    <template #header>
      {{ t('docRepo.create.title') }}
    </template>
    <template #body>
      <div class="warning">
        <b>{{ t('common.warning') }}</b>: {{ t('docRepo.create.embeddingWarning') }}
      </div>
      
      <div class="form-field name">
        <label>{{ t('common.name') }}</label>
        <input type="text" ref="nameInput" v-model="name" required />
      </div>

      <EmbeddingSelector v-model:engine="engine" v-model:model="model" />
    
    </template>
    
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import ModalDialog from '@components/ModalDialog.vue'
import EmbeddingSelector from '@components/EmbeddingSelector.vue'
import Dialog from '@renderer/utils/dialog'

// emits
const emit = defineEmits([ 'save' ])

const dialog = ref(null)
const nameInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const engine = ref('openai')
const model = ref('text-embedding-3-large')

const show = () => {
  console.log('show create dialog')
  reset()
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

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
  const id = window.api.docrepo.create(store.config.workspaceId, name.value, engine.value, model.value)
  emit('save', id)
  close()
}

const onCancel = () => {
  close()
}

defineExpose({ show, close })

</script>

<style>

#docrepo-create .warning {
  color: var(--color-warning);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
}

</style>
