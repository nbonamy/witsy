<template>
  <ModalDialog id="note-editor" ref="dialog" @save="onSave">
    <template #header>
      {{ isEditing ? t('docRepo.note.edit.title') : t('docRepo.note.create.title') }}
    </template>
    <template #body>
      <div class="form-field name">
        <label>{{ t('common.title') }}</label>
        <input type="text" ref="titleInput" v-model="title" required />
      </div>
      <div class="form-field content">
        <label>{{ t('common.content') }}</label>
        <textarea v-model="content" rows="6" required></textarea>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">
          {{ isEditing ? t('common.save') : t('common.create') }}
        </button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import { DocumentSource } from '../types/rag'

// emits
const emit = defineEmits(['save', 'update'])

const dialog = ref(null)
const titleInput = ref<HTMLInputElement | null>(null)
const title = ref('')
const content = ref('')
const isEditing = ref(false)
const editingNote = ref<DocumentSource | null>(null)

const show = () => {
  reset()
  isEditing.value = false
  editingNote.value = null
  dialog.value?.show()
  nextTick(() => {
    titleInput.value?.focus()
  })
}

const showForEdit = (note: DocumentSource) => {
  reset()
  isEditing.value = true
  editingNote.value = note
  title.value = note.title
  content.value = note.origin
  dialog.value?.show()
  nextTick(() => {
    titleInput.value?.focus()
  })
}

const close = () => {
  dialog.value?.close()
}

const reset = () => {
  title.value = ''
  content.value = ''
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (!title.value.trim() || !content.value.trim()) {
    return
  }
  
  if (isEditing.value && editingNote.value) {
    emit('update', { 
      note: editingNote.value,
      title: title.value.trim(), 
      content: content.value.trim() 
    })
  } else {
    emit('save', { title: title.value.trim(), content: content.value.trim() })
  }
  
  close()
}

defineExpose({
  show,
  showForEdit,
  close
})
</script>

<style>

#note-editor .swal2-popup {
  max-width: 28rem;
  width: 28rem;
}

</style>
