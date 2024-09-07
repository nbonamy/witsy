<template>
  <dialog class="docrepos" id="docrepos">
    <form method="dialog">
      <DialogHeader title="Document Repositories" @close="onClose" />
      <main>
        <div class="master">
          <div class="list">
            <template v-for="repo in docRepos" :key="repo.uuid">
              <div :class="{ item: true, selected: repo.uuid == selectedRepo?.uuid }" @click="selectRepo(repo)">
                <div class="name">{{ repo.name }}</div>
              </div>
            </template>
          </div>
          <div class="actions">
            <button class="button" @click.prevent="onCreate"><BIconPlus /></button>
            <button class="button" @click.prevent="onDelete"><BIconDash /></button>
          </div>
        </div>
        <div class="details" v-if="selectedRepo">
          <div class="group name">
            <label>Name</label>
            <input type="text" v-model="selectedRepo.name" @change="onChangeRepoName" />
          </div>
          <div class="group embeddings">
            <label>Embeddings</label>
            <input type="text" :value="selectedRepo.embeddingEngine + ' / ' + selectedRepo.embeddingModel" disabled />
            <BIconPatchExclamation class="embedding-warning" v-if="!modelReady" />
          </div>
          <div class="group documents">
            <div class="header">
              <label>Documents</label>
              <Spinner v-if="loading" />
            </div>
            <div class="list">
              <template v-for="doc in selectedRepo.documents" :key="doc.uuid">
                <div :class="{ item: true, selected: doc.uuid == selectedDoc?.uuid }" @click="selectedDoc = doc">
                  <div class="icon"><Component :is="docIcon(doc)" /></div>
                  <div class="name"><span class="filename">{{ doc.filename }}</span> ({{ doc.origin }})</div>
                </div>
              </template>
            </div>
            <div class="actions">
              <button ref="plusButton" class="button" @click.prevent="showContextMenu"><BIconPlus /></button>
              <button class="button" @click.prevent="onDelDoc"><BIconDash /></button>
            </div>
          </div>
          <ContextMenu v-if="showMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" align="bottom" :teleport="false" />
        </div>
        <div class="empty" v-else>
          <div>
            You don't have any repositories yet.<br />Click on the <span class="button">+</span> button to create one.
          </div>
        </div>
      </main>
    </form>
    <DocRepoCreate />
  </dialog>
</template>

<script setup>

import { ref, onMounted } from 'vue'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import DialogHeader from '../components/DialogHeader.vue'
import ContextMenu from '../components/ContextMenu.vue'
import DocRepoCreate from './DocRepoCreate.vue'
import Spinner from '../components/Spinner.vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

const docRepos = ref([])
const plusButton = ref(null)
const selectedRepo = ref(null)
const selectedDoc = ref(null)
const modelReady = ref(true)
const showMenu = ref(false)
const loading = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const contextMenuActions = [
  { label: 'Add File...', action: 'addFile' },
  { label: 'Add Folder...', action: 'addFolder' },
]

const docIcon = (doc) => {
  if (doc.type === 'file') {
    return 'BIconFileText'
  } else if (doc.type === 'folder') {
    return 'BIconArchive'
  }
  return 'BIconFile'
}

onMounted(async () => {
  window.api.on('docrepo-modified', loadDocRepos)
  window.api.on('docrepo-add-document-error', onAddDocError)
  window.api.on('docrepo-add-document-done', onAddDocDone)
  window.api.on('docrepo-model-downloaded', onModelReady)
  onEvent('openDocRepos', onOpenDocRepos)
  await loadDocRepos()
})

const onModelReady = () => {
  selectRepo(selectedRepo.value)
}

const onOpenDocRepos = () => {
  document.querySelector('#docrepos').showModal()
}

const onClose = () => {
  document.querySelector('#docrepos').close()
}

const loadDocRepos = async () => {
  const selectedRepoId = selectedRepo.value?.uuid
  const repos = await window.api.docrepo?.list()
  //console.log(JSON.stringify(repos, null, 2))
  docRepos.value = repos ?? []
  if (selectedRepoId) {
    selectRepo(docRepos.value.find((repo) => repo.uuid == selectedRepoId))
  }
  if (selectedRepo.value == null && docRepos.value.length > 0) {
    selectRepo(docRepos.value[0])
  }
}

const selectRepo = (repo) => {
  selectedRepo.value = repo
  selectedDoc.value = null
  modelReady.value = window.api.docrepo.isEmbeddingAvailable(selectedRepo.value?.embeddingEngine, selectedRepo.value?.embeddingModel)
  if (selectedRepo.value.documents.length) {
    selectedDoc.value = selectedRepo.value.documents[0]
  }
}

const onCreate = async () => {
  emitEvent('openDocRepoCreate')
}

const onDelete = () => {
  if (!selectedRepo.value) return
  Swal.fire({
    target: document.querySelector('.docrepos'),
    title: 'Are you sure you want to delete this repository? This cannot be undone.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const id = selectedRepo.value.uuid
      selectedRepo.value = null
      window.api.docrepo.delete(id)
    }
  })
}

const onChangeRepoName = (event) => {
  if (!selectedRepo.value) return
  window.api.docrepo.rename(selectedRepo.value.uuid, event.target.value)
}

const onMore = (event) => {
  if (showMenu.value) {
    closeContextMenu()
  } else {
    showContextMenu(event)
  }
}

const showContextMenu = () => {
  showMenu.value = true
  const rcButton = plusButton.value.getBoundingClientRect()
  const rcDialog = document.getElementById('docrepos').getBoundingClientRect()
  menuX.value = rcButton.left - rcDialog.left + 4
  menuY.value = rcDialog.bottom - rcButton.bottom + rcButton.height + 4
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action) => {

  // close
  closeContextMenu()

  // process
  if (action === 'addFile') {
    onAddDoc()
  } else if (action === 'addFolder') {
    onAddFolder()
  }

}

const onAddDoc = () => {
  if (!selectedRepo.value) return
  const files = window.api.file.pick({ multiselection: true })
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

const onAddDocDone = (payload) => {
  console.log('onAddDocDone', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
}

const onAddDocError = (payload) => {
  console.log('onAddDocError', JSON.stringify(payload))
  const queueLength = payload.queueLength
  loading.value = queueLength > 0
  alert(payload.error)
}

const onDelDoc = () => {
  if (!selectedRepo.value || !selectedDoc.value) return
  Swal.fire({
    target: document.querySelector('.docrepos'),
    title: 'Are you sure you want to delete this document? This cannot be undone.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const docId = selectedDoc.value.uuid
      selectedDoc.value = null
      window.api.docrepo.removeDocument(selectedRepo.value.uuid, docId)
    }
  })
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
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

  background-color: white;
  border: 1px solid #D5D4D3;
  border-bottom: 0px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  align-items: start;

  .item {

    display: flex;
    flex-direction: row;
    align-items: center;
    align-self: stretch;

    &.selected {
      background-color: var(--highlight-color);
      color: white;
    }
  }
}

.actions {
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-self: stretch;
  background: linear-gradient(to bottom, #fafafa, #f5f5f5);
  border: 0.8px solid #b4b4b4;

  button {
    border: 0px;
    border-right: 0.8px solid #b4b4b4;
    border-radius: 0px;
    background-color: transparent;
    margin: 0px;
    font-size: 10pt;
    padding-bottom: 2px;

    &:active {
      background: linear-gradient(to bottom, #c0c0c0, #b5b5b5);
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
  background-color: #E6E5E4;
  border-radius: 8px;
  padding: 8px;

  .group label {
    min-width: 100px;
  }
  
  .embeddings {
    margin-top: 0px;
    input {
      background-color: #f5f5f5;
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
        border-bottom: 1px dotted #D5D4D3;
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