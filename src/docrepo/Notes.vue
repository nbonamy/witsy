<template>
  <div class="notes panel">
    <div class="panel-header">
      <label>
        {{ t('common.notes') }}
        <div class="tag info">{{ noteCount() }}</div>
        <div class="subtitle">Add notes to be indexed and searchable</div>
      </label>
      <Spinner class="large" v-if="loading" />
      <div class="icon" @click="togglePanel"><BIconChevronDown /></div>
    </div>
    <div class="panel-body" v-if="notes.length">
      <template v-for="note in notes" :key="note.uuid">
        <div class="panel-item">
          <div class="icon leading"><BIconFileText /></div>
          <div class="info">
            <div class="text">{{ note.title }}</div>
          </div>
          <div class="actions">
            <div class="tag info" v-if="processingItems.includes(note.uuid)">Indexing</div>
            <div class="tag success" v-else>Ready</div>
            <BIconPencil
              class="icon edit"
              v-tooltip="{ text: t('common.edit'), position: 'left' }"
              @click="onEditNote(note)"
            />
            <BIconTrash 
              class="icon remove" 
              v-tooltip="{ text: t('common.delete'), position: 'left' }"
              @click="onDelNote(note)" 
            />
          </div>
        </div>
      </template>
    </div>
    <div class="panel-empty" v-else>
      {{ t('docRepo.note.noNotes') }}
    </div>
    <div class="panel-footer">
      <button name="addNote" @click="onAddNote"><BIconJournalPlus /> {{ t('docRepo.note.add') }}</button>
    </div>
    <NoteEditor ref="noteEditorRef" @save="onNoteSave" @update="onNoteUpdate" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { DocumentBase, DocumentSource, DocRepoAddDocResponse, DocumentQueueItem } from '../types/rag'
import { t } from '../services/i18n'
import { togglePanel } from '../composables/panel'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import NoteEditor from './NoteEditor.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase
}>()

// internal state
const loading = ref(false)
const processingItems = ref<string[]>([])
const noteEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null)

const notes = computed(() => {
  return props.selectedRepo.documents.filter(doc => doc.type === 'text')
})

const noteCount = (): number => {
  return notes.value.length
}

onMounted(() => {
  window.api.on('docrepo-process-item-start', onProcessItemStart)
  window.api.on('docrepo-process-item-done', onProcessItemDone)
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-del-document-done', onDelDocDone)

  window.api.docrepo.getCurrentQueueItem().then((item) => {
    if (item) {
      onProcessItemStart(item)
    }
  })
})

onUnmounted(() => {
  window.api.off('docrepo-process-item-start', onProcessItemStart)
  window.api.off('docrepo-process-item-done', onProcessItemDone)
  window.api.off('docrepo-add-document-done', onAddDocDone)
  window.api.off('docrepo-add-document-error', onAddDocError)
  window.api.off('docrepo-del-document-done', onDelDocDone)
})

const onProcessItemStart = (payload: DocumentQueueItem) => {
  processingItems.value.push(payload.parentDocId ?? payload.uuid)
}

const onProcessItemDone = (payload: DocumentQueueItem) => {
  processingItems.value = processingItems.value.filter(id => id !== (payload.parentDocId ?? payload.uuid))
}

const onAddDocDone = (payload: DocRepoAddDocResponse) => {
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
}

const onAddDocError = (payload: DocRepoAddDocResponse) => {
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
  Dialog.alert(payload.error)
}

const onDelDocDone = (payload: DocRepoAddDocResponse) => {
  loading.value = false
}

const onAddNote = () => {
  noteEditorRef.value?.show()
}

const onNoteSave = async (noteData: { title: string, content: string }) => {
  if (!props.selectedRepo) return
  // Use the new API with explicit title parameter
  loading.value = true
  try {
    await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'text', noteData.content, noteData.title)
  } catch (error) {
    console.error('Error adding note:', error)
    loading.value = false
  }
}

const onNoteUpdate = async (updateData: { note: DocumentSource, title: string, content: string }) => {
  if (!props.selectedRepo) return
  loading.value = true
  try {
    // First remove the old document
    await window.api.docrepo.removeDocument(props.selectedRepo.uuid, updateData.note.uuid)
    // Then add the updated document
    await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'text', updateData.content, updateData.title)
  } catch (error) {
    console.error('Error updating note:', error)
    loading.value = false
  }
}

const onEditNote = (note: DocumentSource) => {
  // Use the editor for editing instead of showing a dialog
  noteEditorRef.value?.showForEdit(note)
}

const onDelNote = (note: DocumentSource) => {
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteDocument'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      loading.value = true
      try {
        await window.api.docrepo.removeDocument(props.selectedRepo.uuid, note.uuid)
      } catch (error) {
        console.error('Error removing note:', error)
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>

.spinner {
  margin-right: 1rem;
}

</style>
