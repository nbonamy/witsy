<template>
  <dialog class="docrepos" id="docrepos">
    <form method="dialog">
      <DialogHeader :title="t('docRepo.repositories.title')" @close="onClose" />
      <main>
        <div class="master list-with-actions">
          <div class="list">
            <template v-for="repo in docRepos" :key="repo.uuid">
              <div :class="{ item: true, selected: repo.uuid == selectedRepo?.uuid }" @click="selectRepo(repo)">
                <div class="name">{{ repo.name }}</div>
              </div>
            </template>
          </div>
          <div class="actions">
            <button class="button create" @click.prevent="onCreate"><BIconPlus /></button>
            <button class="button delete" @click.prevent="onDelete"><BIconDash /></button>
            <button class="button config right lighter" @click.prevent="onConfig"><BIconGearFill /></button>
          </div>
        </div>
        <div class="details" v-if="selectedRepo">
          <div class="group name">
            <label>{{ t('common.name') }}</label>
            <input type="text" v-model="selectedRepo.name" @change="onChangeRepoName" />
          </div>
          <div class="group embeddings">
            <label>{{ t('common.embeddings') }}</label>
            <input type="text" :value="embeddingModel" disabled />
            <BIconPatchExclamation class="embedding-warning" v-if="!modelReady" />
          </div>
          <div class="group documents list-with-actions">
            <div class="header">
              <label>{{ t('common.documents') }}</label>
              <Spinner v-if="loading" />
            </div>
            <div class="list">
              <template v-for="doc in selectedRepo.documents" :key="doc.uuid">
                <div :class="{ item: true, selected: selectedDocs.includes(doc.uuid) }" @click="selectDoc($event, doc)">
                  <div class="icon"><Component :is="docIcon(doc)" /></div>
                  <div class="name"><span class="filename">{{ docLabel(doc) }}</span> ({{ doc.origin }})</div>
                </div>
              </template>
            </div>
            <div class="actions">
              <button ref="plusButton" class="button add" @click.prevent="showContextMenu"><BIconPlus /></button>
              <button class="button remove" @click.prevent="onDelDoc"><BIconDash /></button>
            </div>
          </div>
          <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" position="above" :teleport="false" />
        </div>
        <div class="empty" v-else>
          <div>
            {{ t('docRepo.repositories.noRepositories') }}<br />{{ t('docRepo.repositories.clickToCreate') }}
          </div>
        </div>
      </main>
    </form>
    <DocRepoConfig />
    <DocRepoCreate />
  </dialog>
</template>

<script setup lang="ts">

import { ref, onMounted, computed } from 'vue'
import { DocRepoAddDocResponse, DocumentBase, DocumentSource } from '../types/rag'
import { store } from '../services/store'
import { t } from '../services/i18n'
import LlmFactory from '../llms/llm'
import Dialog from '../composables/dialog'
import DialogHeader from '../components/DialogHeader.vue'
import ContextMenu from '../components/ContextMenu.vue'
import DocRepoConfig from './DocRepoConfig.vue'
import DocRepoCreate from './DocRepoCreate.vue'
import Spinner from '../components/Spinner.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const llmFactory = new LlmFactory(store.config)

const docRepos = ref(null)
const plusButton = ref(null)
const selectedRepo = ref(null)
const selectedDocs = ref([])
const modelReady = ref(true)
const showMenu = ref(false)
const loading = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const contextMenuActions = [
  { label: t('common.actions.addFiles'), action: 'addFiles' },
  { label: t('common.actions.addFolder'), action: 'addFolder' },
]

const docIcon = (doc: DocumentSource) => {
  if (doc.type === 'file') {
    return 'BIconFileText'
  } else if (doc.type === 'folder') {
    return 'BIconArchive'
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
  return llmFactory.getEngineName(selectedRepo.value?.embeddingEngine) + ' / ' + selectedRepo.value?.embeddingModel
})

onMounted(async () => {
  window.api.on('docrepo-modified', loadDocRepos)
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-del-document-done', onDelDocDone)
  window.api.on('docrepo-model-downloaded', onModelReady)
  onEvent('open-doc-repos', onOpenDocRepos)
  await loadDocRepos()
})

const onModelReady = () => {
  selectRepo(selectedRepo.value)
}

const onOpenDocRepos = () => {
  document.querySelector<HTMLDialogElement>('#docrepos').showModal()
}

const onClose = () => {
  document.querySelector<HTMLDialogElement>('#docrepos').close()
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
  selectedDocs.value = []
  modelReady.value = window.api.docrepo.isEmbeddingAvailable(selectedRepo.value?.embeddingEngine, selectedRepo.value?.embeddingModel)
  if (selectedRepo.value.documents.length) {
    selectedDocs.value = [selectedRepo.value.documents[0].uuid]
  }
}

const selectDoc = (event: MouseEvent, doc: DocumentBase) => {
  if (event.metaKey) {
    if (selectedDocs.value.includes(doc.uuid)) {
      selectedDocs.value = selectedDocs.value.filter((d) => d !== doc.uuid)
    } else {
      selectedDocs.value.push(doc.uuid)
    }
  } else {
    selectedDocs.value = [doc.uuid]
  }
}

const onCreate = async () => {
  emitEvent('open-docrepo-create', null)
}

const onDelete = () => {
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

const showContextMenu = () => {
  showMenu.value = true
  const rcButton = plusButton.value.getBoundingClientRect()
  const rcDialog = document.getElementById('docrepos')?.getBoundingClientRect()
  menuX.value = rcButton.left - rcDialog?.left + 4
  menuY.value = rcDialog?.bottom - rcButton.bottom + rcButton.height + 4
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action: string) => {

  // close
  closeContextMenu()

  // process
  if (action === 'addFiles') {
    onAddDocs()
  } else if (action === 'addFolder') {
    onAddFolder()
  }

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
  console.log('onAddDocDone', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
}

const onAddDocError = (payload: DocRepoAddDocResponse) => {
  console.log('onAddDocError', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
  Dialog.alert(payload.error)
}

const onDelDoc = () => {
  if (selectedDocs.value.length == 0) return
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteDocument'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const docIds = selectedDocs.value
      selectedDocs.value = []
      for (const docId of docIds) {
        loading.value = true
        window.api.docrepo.removeDocument(selectedRepo.value.uuid, docId)
      }
    }
  })
}

const onDelDocDone = (payload: DocRepoAddDocResponse) => {
  loading.value = false
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/list-with-actions.css';
</style>

<style scoped>
dialog.docrepos {
  width: 640px;
}

main {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding: 20px;
  height: 360px;
}

.list {

  .item {

    display: flex;
    flex-direction: row;
    align-items: center;
    align-self: stretch;

    &.selected {
      background-color: var(--highlight-color);
      color: var(--highlighted-color);
    }
  }
}

.master {
  display: flex;
  flex-direction: column;

  .list {
    width: 160px;

    .item {
      .name {
        padding: 12px 8px;
        font-size: 10pt;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.details {
  
  display: flex;
  flex-direction: column;
  margin-left: 16px;
  background-color: var(--dialog-body-bg-color);
  border-radius: 8px;
  padding: 8px;

  .group label {
    min-width: 100px;
  }
  
  .embeddings {
    margin-top: 0px;
    input {
      background-color: var(--control-bg-color);
    }
    .embedding-warning {
      color: red;
      margin-left: 4px;
    }
  }

  .documents {

    display: flex;
    flex-direction: column;
    margin: 8px 6px 8px 6px;
    flex-grow: 1;

    .header {
      align-self: stretch;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      padding-right: 4px;

      label {
        align-self: start;
        text-align: left;
        margin-bottom: 8px;

        &::after {
          content: '';
        }
      }

      .loader {
        height: 6px;
        width: 6px;
        margin: 4px;
      }

    }

    .list {

      width: 384px; /* would want to be 100% but then ellipsis don't work */
      border-radius: 2px;

      .item {
        padding: 8px;
        font-size: 9.5pt;
        border-bottom: 1px dotted var(--control-border-color);
        display: flex;
        flex-direction: row;

        .icon {
          flex: 0 0 24px;
          position: relative;
          top: 1px;
        }
        .name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          position: relative;
          top: -2px;

          .filename {
            font-weight: 600;
          }
        }

      }
    }
  }
}

.empty {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  font-size: 11pt;
  line-height: 1.5;
  text-align: center;
}

</style>