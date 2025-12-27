<template>
  <div class="notes panel">
    <div class="panel-header" @click="togglePanel">
      <label>
        {{ t('common.notes') }}
        <div class="tag info">{{ noteCount() }}</div>
        <div class="subtitle">Add notes to be indexed and searchable</div>
      </label>
      <div class="icon"><ChevronDownIcon /></div>
    </div>
    <div class="panel-body" v-if="notes.length">
      <template v-for="note in notes" :key="note.uuid">
        <div class="panel-item">
          <div class="icon leading"><FileTextIcon /></div>
          <div class="info">
            <div class="text">{{ note.title }}</div>
          </div>
          <div class="actions">
            <div class="tag info" v-if="processingItems.includes(note.uuid)">Indexing</div>
            <div class="tag success" v-else>Ready</div>
            <PencilIcon
              class="icon edit"
              v-tooltip="{ text: t('common.edit'), position: 'left' }"
              @click="onEditNote(note)"
            />
            <Trash2Icon
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
      <button name="addNote" @click="onAddNote"><FilePlusIcon /> {{ t('docRepo.note.add') }}</button>
    </div>
    <NoteEditor ref="noteEditorRef" @save="onNoteSave" @update="onNoteUpdate" />
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, FilePlusIcon, FileTextIcon, PencilIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import Dialog from '@renderer/utils/dialog'
import { togglePanel } from '@renderer/utils/panel'
import { useDocRepoEvents } from '@composables/useDocRepoEvents'
import { t } from '@services/i18n'
import { DocumentBase, DocumentSource } from 'types/rag'
import NoteEditor from './NoteEditor.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase
}>()

// use composable for IPC events
const { loading, processingItems } = useDocRepoEvents('text')

// internal state
const noteEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null)

const notes = computed(() => {
  return props.selectedRepo.documents.filter(doc => doc.type === 'text')
})

const noteCount = (): number => {
  return notes.value.length
}

const onAddNote = () => {
  noteEditorRef.value?.show()
}

const onNoteSave = async (noteData: { title: string, content: string }) => {
  if (!props.selectedRepo) return
  // Use the new API with explicit title parameter
  loading.value = true
  try {
    await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'text', noteData.content, { title: noteData.title, skipSizeCheck: true })
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
    await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'text', updateData.content, { title: updateData.title, skipSizeCheck: true })
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
