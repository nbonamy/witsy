<template>
  <div class="documents panel">
    <div class="panel-header" @click="togglePanel">
      <label>
        {{ t('common.documents') }}
        <div class="tag info">{{ documentCount() }}</div>
        <div class="subtitle">{{ t('docRepo.file.help.formats') }}</div>
      </label>
      <div class="icon"><ChevronDownIcon /></div>
    </div>
    <div class="panel-body" v-if="files.length">
      <template v-for="doc in files" :key="doc.uuid">
        <div class="panel-item">
          <div class="icon leading"><Component :is="docIcon(doc)" /></div>
          <div class="info">
            <div class="text">{{ doc.filename }}</div>
            <div class="subtext" v-if="doc.type === 'folder'">{{ t('docRepo.list.documentsCount', { count: docSourceCount(doc) } ) }}</div>
            <div class="subtext" v-else>{{ filesize(doc.fileSize) }}</div>
          </div>
          <div class="actions">
            <div class="tag info" v-if="processingItems.includes(doc.uuid)">
              {{ t('docRepo.status.wip') }}
            </div>
            <div class="tag success" v-else>{{ t('docRepo.status.done') }}</div>
            <SearchIcon
              :style="{ visibility: doc.type === 'folder' ? 'visible' : 'hidden' }"
              class="icon view-contents"
              v-tooltip="{ text: t('docRepo.view.tooltips.viewContents'), position: 'left' }"
              @click="onViewFolderContents(doc)"
            />
            <FolderIcon
              v-if="doc.type === 'file' || doc.type === 'folder'"
              class="icon open-in-explorer"
              v-tooltip="{ text: t('docRepo.view.tooltips.openInExplorer'), position: 'left' }"
              @click="onOpenInExplorer(doc)"
            />
            <Trash2Icon v-if="!processingItems.includes(doc.uuid)"
              class="icon remove"
              v-tooltip="{ text: t('common.delete'), position: 'left' }"
              @click="onDelDoc(doc)"
            />
            <SquareIcon v-else
              class="icon cancel-task"
              v-tooltip="{ text: t('common.cancel'), position: 'left' }"
              @click="onCancelTask(doc)"
            />
          </div>
        </div>
      </template>
    </div>
    <div class="panel-empty" v-else>
      {{ t('docRepo.view.noDocuments') }}
    </div>
    <div class="panel-footer">
      <button name="addDocs" @click="onAddFiles"><FilePlusIcon /> {{ t('docRepo.view.tooltips.addFile') }}</button>
      <button name="addFolder" @click="onAddFolder"><FolderPlusIcon /> {{ t('docRepo.view.tooltips.addFolder') }}</button>
    </div>
    <Folder ref="folderRef" :folder="selectedFolder" @close="selectedFolder = null" />
  </div>
</template>

<script setup lang="ts">
import { filesize } from 'filesize'
import { ChevronDownIcon, FileIcon, FileImageIcon, FilePlusIcon, FileSpreadsheetIcon, FileTextIcon, FolderIcon, FolderPlusIcon, SearchIcon, SquareIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import { extensionToMimeType } from 'multi-llm-ts'
import { computed, ref } from 'vue'
import Dialog from '@renderer/utils/dialog'
import { togglePanel } from '@renderer/utils/panel'
import { useDocRepoEvents } from '@composables/useDocRepoEvents'
import { t } from '@services/i18n'
import { DocumentBase, DocumentSource } from 'types/rag'
import Folder from './Folder.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase
}>()

// use composable for IPC events
const { loading, processingItems } = useDocRepoEvents('file')

// internal state
const folderRef = ref<InstanceType<typeof Folder> | null>(null)
const selectedFolder = ref<DocumentSource | null>(null)
const taskIds = ref<Map<string, string>>(new Map()) // Map doc.uuid to taskId

const files = computed(() => {
  return props.selectedRepo.documents.filter(doc => ['file', 'folder'].includes(doc.type))
})

const docSourceCount = (source: DocumentSource): number => {
  return (source.type === 'folder' ? 0 : 1) + (source.items?.reduce((acc, item) => acc + docSourceCount(item), 0) ?? 0)
}

const documentCount = (): number => {
  return files.value.reduce((acc, doc) => acc + docSourceCount(doc), 0)
}

const docIcon = (doc: DocumentSource) => {
  if (doc.type === 'file') {
    const mimeType = extensionToMimeType(doc.filename.split('.').pop() ?? '')
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return FileTextIcon
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return FileSpreadsheetIcon
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return FileImageIcon
    } else if (mimeType === 'application/pdf') {
      return FileTextIcon
    } else {
      return FileTextIcon
    }
  } else if (doc.type === 'folder') {
    return FolderIcon
  }
  return FileIcon
}

const onAddFiles = async () => {
  if (!props.selectedRepo) return
  const files = window.api.file.pickFile({ multiselection: true }) as string[]
  if (!files) return
  
  // Check if all files are supported
  const unsupportedFiles: string[] = []
  for (const file of files) {
    if (!window.api.docrepo.isSourceSupported('file', file)) {
      unsupportedFiles.push(file)
    }
  }
  
  // Show error for unsupported files
  if (unsupportedFiles.length > 0) {
    const fileNames = unsupportedFiles.map(f => f.split('/').pop() || f)
    Dialog.show({
      title: t('docRepo.file.error.formatNotSupported.title'),
      html: fileNames.join('<br/>')
    })
    return
  }
  
  loading.value = true
  try {
    // Don't await - let documents be added to queue asynchronously
    // The UI will be updated via IPC events when processing completes
    for (const file of files) {
      const promise = window.api.docrepo.addDocument(props.selectedRepo.uuid, 'file', file)
      promise.then(taskId => {
        // Store task ID for this file
        // Map by origin (file path) since we don't have doc.uuid yet
        taskIds.value.set(file, taskId)
      }).catch(error => {
        console.error('Error adding file:', error)
      })
    }
  } catch (error) {
    console.error('Error adding files:', error)
    loading.value = false
  }
}

const onAddFolder = async () => {
  if (!props.selectedRepo) return
  const folder = window.api.file.pickDirectory()
  if (!folder) return
  loading.value = true
  try {
    // Don't await - let folder be added to queue asynchronously
    // The UI will be updated via IPC events when processing completes
    const promise = window.api.docrepo.addDocument(props.selectedRepo.uuid, 'folder', folder)
    promise.then(taskId => {
      // Store task ID for this folder
      taskIds.value.set(folder, taskId)
    }).catch(error => {
      console.error('Error adding folder:', error)
    })
  } catch (error) {
    console.error('Error adding folder:', error)
    loading.value = false
  }
}

const onDelDoc = (doc: DocumentSource) => {
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
        await window.api.docrepo.removeDocument(props.selectedRepo.uuid, doc.uuid)
      } catch (error) {
        console.error('Error removing document:', error)
        loading.value = false
      }
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

const onCancelTask = async (doc: DocumentSource) => {
  const taskId = taskIds.value.get(doc.origin)
  if (taskId) {
    try {
      await window.api.docrepo.cancelTask(taskId)
      taskIds.value.delete(doc.origin)
    } catch (error) {
      console.error('Error cancelling task:', error)
    }
  }
}
</script>
