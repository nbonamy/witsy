<template>
  <main v-if="selectedRepo">
    <div class="info panel">
      <div class="panel-header">
        {{ t('docRepo.view.title') }}
      </div>
      <div class="panel-body form form-large">
        <div class="form-field name">
          <label>{{ t('common.name') }}</label>
          <input type="text" v-model="selectedRepo.name" @change="onChangeRepoName" />
        </div>
        <div class="form-field embeddings">
          <label>{{ t('common.embeddings') }}</label>
          <input type="text" :value="embeddingModel" disabled />
          <BIconPatchExclamation 
            class="embedding-warning" 
            v-if="!modelReady" 
            v-tooltip="{ text: t('docRepo.view.tooltips.embeddingNotReady'), position: 'right' }"
          />
        </div>
      </div>
    </div>
    <div class="documents panel">
      <div class="panel-header">
        <label>{{ t('common.documents') }}</label>
        <Spinner v-if="loading" />
        <BIconFilePlus 
          class="icon add-file" 
          v-tooltip="{ text: t('docRepo.view.tooltips.addFile'), position: 'bottom-left' }"
          @click="onAddDocs" 
        />
        <BIconFolderPlus 
          class="icon add-folder" 
          v-tooltip="{ text: t('docRepo.view.tooltips.addFolder'), position: 'bottom-left' }"
          @click="onAddFolder" 
        />
      </div>
      <div class="panel-body" v-if="selectedRepo.documents.length">
        <template v-for="doc in selectedRepo.documents" :key="doc.uuid">
          <div class="panel-item">
            <div class="icon leading"><Component :is="docIcon(doc)" /></div>
            <div class="info">
              <div class="text">{{ docLabel(doc) }}</div>
              <div class="subtext">{{ doc.origin }}</div>
            </div>
            <div class="actions">
              <BIconTrash 
                class="icon remove" 
                v-tooltip="{ text: t('docRepo.view.tooltips.removeDocument'), position: 'top-left' }"
                @click="onDelDoc(doc)" 
              />
            </div>
          </div>
        </template>
      </div>
      <div class="panel-empty" v-else>
        <div>{{ t('docRepo.view.noDocuments') }}</div>
      </div>
    </div>
  </main>
</template><script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { DocumentBase, DocumentSource, DocRepoAddDocResponse } from '../types/rag'
import { extensionToMimeType } from 'multi-llm-ts'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'

const llmManager: ILlmManager = LlmFactory.manager(store.config)

// props
const props = defineProps<{
  selectedRepo: DocumentBase | null
}>()

// emits
const emit = defineEmits<{
  rename: [event: Event]
}>()

// internal state
const loading = ref(false)
const modelReady = ref(true)

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
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-del-document-done', onDelDocDone)
  window.api.on('docrepo-model-downloaded', onModelReady)
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

const embeddingModel = computed(() => {
  if (!props.selectedRepo) return ''
  return llmManager.getEngineName(props.selectedRepo.embeddingEngine) + ' / ' + props.selectedRepo.embeddingModel
})

const onChangeRepoName = (event: Event) => {
  emit('rename', event)
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
</script>

<style scoped>

main {
  overflow: hidden;
  margin: 2rem auto;
  min-width: 800px;
}

.info {

  .form {

    gap: 0px;

    .embeddings {
      margin-top: 0px;
    }

    .embeddings input {
      background-color: var(--control-bg-color);
      outline: none;
      border: none;
    }

    .embedding-warning {
      color: red;
      margin-left: 4px;
    }

  }

}

.documents {
  flex-grow: 1;
}

* {
  color: var(--text-color);
}
</style>
