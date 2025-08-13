<template>
  <div class="documents panel">
    <div class="panel-header">
      <label>
        {{ t('common.documents') }}
        <div class="tag info">{{ documentCount() }}</div>
        <div class="subtitle">Add.pdf,.csv, .md, json, .epub, .docx, .rft, and .txt files</div>
      </label>
      <Spinner class="large" v-if="loading" />
      <div class="icon" @click="togglePanel"><BIconChevronDown /></div>
    </div>
    <div class="panel-body" v-if="selectedRepo.documents.length">
      <template v-for="doc in selectedRepo.documents" :key="doc.uuid">
        <div class="panel-item">
          <div class="icon leading"><Component :is="docIcon(doc)" /></div>
          <div class="info">
            <div class="text">{{ doc.origin }}</div>
            <div class="subtext" v-if="doc.type === 'folder'">{{ t('docRepo.list.documentsCount', { count: docSourceCount(doc) } ) }}</div>
            <div class="subtext" v-else>{{ filesize(doc.fileSize) }}</div>
          </div>
          <div class="actions">
            <div class="tag info" v-if="processingItems.includes(doc.uuid)">Indexing</div>
            <div class="tag success" v-else>Ready</div>
            <BIconSearch 
              :style="{ visibility: doc.type === 'folder' ? 'visible' : 'hidden' }"
              class="icon view-contents" 
              v-tooltip="{ text: t('docRepo.view.tooltips.viewContents'), position: 'left' }"
              @click="onViewFolderContents(doc)" 
            />
            <BIconFolder
              v-if="doc.type === 'file' || doc.type === 'folder'"
              class="icon open-in-explorer" 
              v-tooltip="{ text: t('docRepo.view.tooltips.openInExplorer'), position: 'left' }"
              @click="onOpenInExplorer(doc)" 
            />
            <BIconTrash 
              class="icon remove" 
              v-tooltip="{ text: t('docRepo.view.tooltips.removeDocument'), position: 'left' }"
              @click="onDelDoc(doc)" 
            />
          </div>
        </div>
      </template>
    </div>
    <div class="panel-empty" v-else>
      {{ t('docRepo.view.noDocuments') }}
    </div>
    <div class="panel-footer">
      <button name="addDocs" @click="onAddDocs"><BIconFilePlus /> {{ t('docRepo.view.tooltips.addFile') }}</button>
      <button name="addFolder" @click="onAddFolder"><BIconFolderPlus /> {{ t('docRepo.view.tooltips.addFolder') }}</button>
    </div>
    <Folder ref="folderRef" :folder="selectedFolder" @close="selectedFolder = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { DocumentBase, DocumentSource, DocRepoAddDocResponse, DocumentQueueItem } from '../types/rag'
import { extensionToMimeType } from 'multi-llm-ts'
import { filesize } from 'filesize'
import { t } from '../services/i18n'
import { togglePanel } from '../composables/panel'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import Folder from './Folder.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase
}>()

// internal state
const loading = ref(false)
const processingItems = ref<string[]>([])
const folderRef = ref<InstanceType<typeof Folder> | null>(null)
const selectedFolder = ref<DocumentSource | null>(null)

const docSourceCount = (source: DocumentSource): number => {
  return (source.type === 'folder' ? 0 : 1) + (source.items?.reduce((acc, item) => acc + docSourceCount(item), 0) ?? 0)
}

const documentCount = (): number => {
  return props.selectedRepo.documents.reduce((acc, doc) => acc + docSourceCount(doc), 0)
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

const docIcon = (doc: DocumentSource) => {
  if (doc.type === 'file') {
    const mimeType = extensionToMimeType(doc.filename.split('.').pop() ?? '')
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'BIconFileWord'
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return 'BIconFileExcel'
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return 'BIconFileSlides'
    } else if (mimeType === 'application/pdf') {
      return 'BIconFilePdf'
    } else {
      return 'BIconFileText'
    }
  } else if (doc.type === 'folder') {
    return 'BIconFolder'
  }
  return 'BIconFile'
}

const docLabel = (doc: DocumentSource) => {
  if (doc.type === 'folder') {
    return `${doc.filename} (${doc.items.length} ${t('common.files')})`
  } else {
    return doc.filename
  }
}

const onAddDocs = () => {
  if (!props.selectedRepo) return
  const files = window.api.file.pickFile({ multiselection: true }) as string[]
  if (!files) return
  for (const file of files) {
    window.api.docrepo.addDocument(props.selectedRepo.uuid, 'file', file)
  }
  loading.value = true
}

const onAddFolder = () => {
  if (!props.selectedRepo) return
  const folder = window.api.file.pickDirectory()
  if (!folder) return
  window.api.docrepo.addDocument(props.selectedRepo.uuid, 'folder', folder)
  loading.value = true
}

const onDelDoc = (doc: DocumentSource) => {
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteDocument'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      loading.value = true
      window.api.docrepo.removeDocument(props.selectedRepo.uuid, doc.uuid)
    }
  })
}

const onOpenInExplorer = (doc: DocumentSource) => {
  if (doc.type === 'file' || doc.type === 'folder') {
    window.api.file.openInExplorer(doc.origin)
  }
}

const onViewFolderContents = (doc: DocumentSource) => {
  if (doc.type !== 'folder') return
  selectedFolder.value = doc
  folderRef.value?.show()
}
</script>

<style scoped>

.spinner {
  margin-right: 1rem;
}

</style>
