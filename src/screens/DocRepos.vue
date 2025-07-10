<template>
  <div class="docrepo panel-content" v-bind="$attrs">
    <div class="panel">
      <header>
        <div class="title">{{ t('docRepo.repositories.title') }}</div>
        <BIconPlusLg class="icon create" @click="onCreate" />
      </header>
      <main>
        <div class="list">
          <template v-for="repo in docRepos" :key="repo.uuid">
            <div :class="{ item: true, selected: repo.uuid == selectedRepo?.uuid }" @click="selectRepo(repo)">
              <BIconArchive class="icon" />
              <div class="name">{{ repo.name }}</div>
            </div>
          </template>
        </div>
      </main>
      <footer>
        <BIconSliders class="icon config" @click="onConfig" />
      </footer>
    </div>
    <div class="content">
      <header>
        <div class="title">{{ selectedRepo?.name }}</div>
        <BIconTrash class="icon delete" @click="onDeleteRepo" v-if="selectedRepo" />
      </header>
      <main v-if="selectedRepo">
        <form class="header large">
          <div class="group name">
            <label>{{ t('common.name') }}</label>
            <input type="text" v-model="selectedRepo.name" @change="onChangeRepoName" />
          </div>
          <div class="group embeddings">
            <label>{{ t('common.embeddings') }}</label>
            <input type="text" :value="embeddingModel" disabled />
            <BIconPatchExclamation class="embedding-warning" v-if="!modelReady" />
          </div>
        </form>
        <div class="group documents list-large-with-header">
          <div class="header">
            <label>{{ t('common.documents') }}</label>
            <Spinner v-if="loading" />
            <BIconFilePlus class="icon add-file" @click="onAddDocs" />
            <BIconFolderPlus class="icon add-folder" @click="onAddFolder" />
          </div>
          <div class="list" v-if="selectedRepo.documents.length">
            <template v-for="doc in selectedRepo.documents" :key="doc.uuid">
              <div class="item">
                <div class="icon leading"><Component :is="docIcon(doc)" /></div>
                <div class="info">
                  <div class="text">{{ docLabel(doc) }}</div>
                  <div class="subtext">{{ doc.origin }}</div>
                </div>
                <div class="actions">
                  <!-- <BIconArrowClockwise class="icon" @click="onRefreshDoc(doc)" /> -->
                  <BIconTrash class="icon remove error" @click="onDelDoc(doc)" />
                </div>
              </div>
            </template>
          </div>
          <div class="empty" v-else>
            <div>{{ t('docRepo.repositories.noDocuments') }}</div>
          </div>
        </div>
      </main>
      <main class="empty" v-else>
        <div>
          {{ t('docRepo.repositories.noRepositories') }}<br />{{ t('docRepo.repositories.clickToCreate') }}
        </div>
      </main>
    </div>
  </div>
  <DocRepoConfig />
  <DocRepoCreate />
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { DocRepoAddDocResponse, DocumentBase, DocumentSource } from '../types/rag'
import { extensionToMimeType } from 'multi-llm-ts'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Dialog from '../composables/dialog'
import DocRepoConfig from './DocRepoConfig.vue'
import DocRepoCreate from './DocRepoCreate.vue'
import Spinner from '../components/Spinner.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const docRepos = ref(null)
const selectedRepo= ref<DocumentBase | null>(null)
const modelReady = ref(true)
const loading = ref(false)

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
  return llmManager.getEngineName(selectedRepo.value?.embeddingEngine) + ' / ' + selectedRepo.value?.embeddingModel
})

onMounted(async () => {
  window.api.on('docrepo-modified', loadDocRepos)
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-del-document-done', onDelDocDone)
  window.api.on('docrepo-model-downloaded', onModelReady)
  onEvent('create-docrepo', onCreate)
  await loadDocRepos()
})

onUnmounted(() => {
  window.api.off('docrepo-modified', loadDocRepos)
  window.api.off('docrepo-add-document-done', onAddDocDone)
  window.api.off('docrepo-add-document-error', onAddDocError)
  window.api.off('docrepo-del-document-done', onDelDocDone)
  window.api.off('docrepo-model-downloaded', onModelReady)
})

const onModelReady = () => {
  selectRepo(selectedRepo.value)
}

const loadDocRepos = async () => {
  const selectedRepoId = selectedRepo.value?.uuid
  const repos = await window.api.docrepo?.list()
  docRepos.value = repos ?? []
  if (selectedRepoId) {
    selectRepo(docRepos.value.find((repo: DocumentBase) => repo.uuid == selectedRepoId))
  }
  if (selectedRepo.value == null && docRepos.value.length > 0) {
    selectRepo(docRepos.value[0])
  }
}

const selectRepo = (repo: DocumentBase) => {
  selectedRepo.value = repo
  modelReady.value = window.api.docrepo.isEmbeddingAvailable(selectedRepo.value?.embeddingEngine, selectedRepo.value?.embeddingModel)
}

const onCreate = async () => {
  emitEvent('open-docrepo-create', null)
}

const onDeleteRepo = () => {
  if (!selectedRepo.value) return
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteRepository'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const id = selectedRepo.value.uuid
      selectedRepo.value = null
      window.api.docrepo.delete(id)
    }
  })
}

const onConfig = () => {
  emitEvent('open-docrepo-config', null)
}

const onChangeRepoName = (event: Event) => {
  if (!selectedRepo.value) return
  window.api.docrepo.rename(selectedRepo.value.uuid, (event.target as HTMLInputElement).value)
}

const onAddDocs = () => {
  if (!selectedRepo.value) return
  const files = window.api.file.pick({ multiselection: true }) as string[]
  if (!files) return
  for (const file of files) {
    window.api.docrepo.addDocument(selectedRepo.value.uuid, 'file', file)
  }
  loading.value = true
}

const onAddFolder = () => {
  if (!selectedRepo.value) return
  const folder = window.api.file.pickDir()
  if (!folder) return
  window.api.docrepo.addDocument(selectedRepo.value.uuid, 'folder', folder)
  loading.value = true
}

const onAddDocDone = (payload: DocRepoAddDocResponse) => {
  // console.log('onAddDocDone', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
}

const onAddDocError = (payload: DocRepoAddDocResponse) => {
  // console.log('onAddDocError', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
  Dialog.alert(payload.error)
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
      window.api.docrepo.removeDocument(selectedRepo.value.uuid, doc.uuid)
    }
  })
}

const onDelDocDone = (payload: DocRepoAddDocResponse) => {
  loading.value = false
}

// const onRefreshDoc = (doc: DocumentSource) => {
//   window.api.docrepo.refreshDocument(selectedRepo.value.uuid, doc.uuid)
// }

</script>

<style scoped>
@import '../../css/panel-content.css';
@import '../../css/form.css';
@import '../../css/list-large-with-header.css';
</style>

<style scoped>

* {
  color: var(--text-color);
  scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
}

.list {

  padding: 0 .5rem;
  overflow-y: auto;

  .item {

    display: flex;
    flex-direction: row;
    align-items: center;
    align-self: stretch;
    border-radius: 4px;

    &.selected {
      background-color: var(--sidebar-selected-color);
    }
  }
}

.panel-content {

  .panel {

    flex-basis: 250px;

    .list {
      .item {

        display: flex;
        flex-direction: row;
        padding: 1rem 0.5rem;
        cursor: pointer;
        gap: 0.25rem;

        .icon {
          color: var(--text-color);
        }

        .name {
          font-size: 11pt;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0.36px;
        }

        &.selected {
          .name {
            font-weight: 600;
            letter-spacing: normal;
          }
        }
      }
    }
  }

  .content {

    main {

      overflow: hidden;

      form.header {
        
        display: flex;
        flex-direction: column;
        padding: 1rem;

        .group label {
          min-width: 100px;
        }
        
        .embeddings {
          margin-top: 0px;
          input {
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

      &.empty {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 16px;
        font-size: 14pt;
        line-height: 1.5;
        text-align: center;
        opacity: 0.6;
      }

    }

  }

}

</style>
