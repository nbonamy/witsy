<template>
  <main v-if="selectedRepo">
    <div class="info panel collapsed">
      <div class="panel-header">
        <label>{{ t('embedding.model') }}</label>
        <div class="icon" @click="togglePanel"><BIconChevronDown /></div>
      </div>
      <div class="panel-body">
        <div class="embeddings">
          <div class="info">
            <EngineLogo class="engine" :engine="selectedRepo.embeddingEngine" />
            <span class="model">{{ selectedRepo.embeddingModel }}</span>
          </div>
          <BIconPatchExclamation 
            class="warning" 
            v-if="!modelReady" 
            v-tooltip="{ text: t('docRepo.view.tooltips.embeddingNotReady'), position: 'right' }"
          />
        </div>
      </div>
    </div>
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
    </div>
    <Folder ref="folderRef" :folder="selectedFolder" @close="selectedFolder = null" />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { DocumentBase, DocumentSource, DocRepoAddDocResponse, DocumentQueueItem } from '../types/rag'
import { extensionToMimeType } from 'multi-llm-ts'
import { filesize } from 'filesize'
import { t } from '../services/i18n'
import { togglePanel } from '../composables/panel'
import Dialog from '../composables/dialog'
import EngineLogo from '../components/EngineLogo.vue'
import Spinner from '../components/Spinner.vue'
import Folder from './Folder.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase | null
}>()

// internal state
const loading = ref(false)
const modelReady = ref(true)
const processingItems = ref<string[]>([])
const folderRef = ref<InstanceType<typeof Folder> | null>(null)
const selectedFolder = ref<DocumentSource | null>(null)

const docSourceCount = (source: DocumentSource): number => {
  return (source.type === 'folder' ? 0 : 1) + (source.items?.reduce((acc, item) => acc + docSourceCount(item), 0) ?? 0)
}

const documentCount = (): number => {
  return props.selectedRepo.documents.reduce((acc, doc) => acc + docSourceCount(doc), 0)
}

const updateModelReady = () => {
  if (props.selectedRepo) {
    modelReady.value = window.api.docrepo.isEmbeddingAvailable(
      props.selectedRepo.embeddingEngine, 
      props.selectedRepo.embeddingModel
    )
  }
}

const onModelReady = () => {
  updateModelReady()
}

onMounted(() => {
  window.api.on('docrepo-process-item-start', onProcessItemStart)
  window.api.on('docrepo-process-item-done', onProcessItemDone)
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-del-document-done', onDelDocDone)
  window.api.on('docrepo-model-downloaded', onModelReady)

  window.api.docrepo.getCurrentQueueItem().then((item) => {
    if (item) {
      onProcessItemStart(item)
    }
  })

})

onUnmounted(() => {
  window.api.off('docrepo-add-document-done', onAddDocDone)
  window.api.off('docrepo-add-document-error', onAddDocError)
  window.api.off('docrepo-del-document-done', onDelDocDone)
  window.api.off('docrepo-model-downloaded', onModelReady)
})

// Watch for changes to selectedRepo to update modelReady
watch(() => props.selectedRepo, () => {
  updateModelReady()
}, { immediate: true })

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

main {
  overflow: hidden;
  height: 100%;
  gap: 1rem;
  padding: 1.5rem;
}

.info {

  .panel-body {

    gap: 0.25rem;

    .embeddings input {
      background-color: var(--control-bg-color);
      outline: none;
      border: none;
    }

    .info {
      
      align-self: flex-start;
      border: 1px solid var(--control-border-color);
      background-color: var(--control-disabled-bg-color);
      border-radius: 0.5rem;
      padding: 0.75rem 1.25rem;

      display: flex;
      align-items: center;
      gap: 0.75rem;

      .engine {
        width: 1.25rem;
        height: 1.25rem;
      }

      .model {
        font-size: 11.5pt;
        color: var(--faded-text-color);
      }
    }

    .warning {
      color: red;
      margin-left: 4px;
    }

  }

}

.spinner {
  margin-right: 1rem;
}

.documents:not(.collapsed) {
  flex-grow: 1;
}

</style>
