<template>
  <Empty v-if="!docRepos?.length && !selectedRepo" @click="onCreate" />
  <div v-else class="docrepo split-pane">
    <div class="sp-sidebar">
      <header>
        <div class="title">{{ t('docRepo.list.title') }}</div>
        <ButtonIcon class="config" v-tooltip="{ text: t('docRepo.list.tooltips.config'), position: 'bottom' }" @click="onConfig">
          <Settings2Icon />
        </ButtonIcon>
      </header>
      <main>
        <List :docRepos="docRepos || []" :selectedRepo="selectedRepo" @selectRepo="selectRepo" @create="onCreate" @config="onConfig" />
      </main>
      <footer>
        <button class="new-collection cta" @click="onCreate"><FolderPlusIcon /> {{ t('docRepo.create.title') }}</button>
      </footer>
    </div>
    <div class="sp-main">
      <header v-if="mode === 'view'">
        <div class="title-section">
          <div v-if="!isEditingTitle" class="title-display">
            <span class="title">{{ selectedRepo?.name }}</span>
            <ButtonIcon class="edit-title" v-tooltip="{ text: t('common.edit'), position: 'bottom' }" @click="startEditingTitle">
              <PencilIcon />
            </ButtonIcon>
          </div>
          <div v-else class="title-edit">
            <input 
              ref="titleInput"
              type="text" 
              v-model="editingTitle"
              @keyup.enter="saveTitle"
              @keyup.escape="cancelEditingTitle"
              class="title-input"
            />
            <div class="actions">
              <ButtonIcon class="save" v-tooltip="{ text: t('common.save'), position: 'bottom' }" @click="saveTitle" >
                <CheckIcon />
              </ButtonIcon>              
              <ButtonIcon class="cancel" v-tooltip="{ text: t('common.cancel'), position: 'bottom' }" @click="cancelEditingTitle">
                <XIcon />
              </ButtonIcon>
            </div>
          </div>
        </div>
        <ButtonIcon class="search" v-tooltip="{ text: t('docRepo.search.title'), position: 'bottom-left' }" v-if="!isEditingTitle" @click="onSearch">
          <SearchIcon />
        </ButtonIcon>
        <ButtonIcon class="delete" v-tooltip="{ text: t('docRepo.list.tooltips.delete'), position: 'bottom-left' }" v-if="!isEditingTitle" @click="onDeleteRepo(selectedRepo)">
          <Trash2 />
        </ButtonIcon>
      </header>
      <View :selectedRepo="selectedRepo" v-if="mode === 'view'"/>
    </div>
    <Config ref="configDialog" />
  </div>
  <Create ref="createDialog" @save="onCreateSave" />
</template>

<script setup lang="ts">

import { CheckIcon, FolderPlusIcon, PencilIcon, SearchIcon, Settings2Icon, Trash2, XIcon } from 'lucide-vue-next'
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import Dialog from '@renderer/utils/dialog'
import useEventBus from '@composables/event_bus'
import Config from '../docrepo/Config.vue'
import Create from '../docrepo/Create.vue'
import Empty from '../docrepo/Empty.vue'
import List from '../docrepo/List.vue'
import View from '../docrepo/View.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { DocumentBase } from 'types/rag'

const { onEvent } = useEventBus()

type DocRepoMode = 'list' | 'view'

const mode = ref<DocRepoMode>('list')
const docRepos = ref(null)
const selectedRepo = ref<DocumentBase | null>(null)
const configDialog = ref(null)
const createDialog = ref(null)

// Title editing state
const isEditingTitle = ref(false)
const editingTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  window.api.on('docrepo-modified', loadDocRepos)
  onEvent('create-docrepo', onCreate)
  loadDocRepos()
})

onBeforeUnmount(() => {
  window.api.off('docrepo-modified', loadDocRepos)
})

const loadDocRepos = () => {
  const selectedRepoId = selectedRepo.value?.uuid
  const repos = window.api.docrepo?.list(store.config.workspaceId)
  docRepos.value = repos ?? []
  if (selectedRepoId) {
    selectRepo(docRepos.value.find((repo: DocumentBase) => repo.uuid == selectedRepoId))
  } else if (docRepos.value.length > 0) {
    // Select the first repository if none is currently selected
    selectRepo(docRepos.value[0])
  }
}

const selectRepo = (repo: DocumentBase | null) => {
  if (!repo) {
    selectedRepo.value = null
    mode.value = 'list'
  } else {
    selectedRepo.value = repo
    mode.value = 'view'
  }
}

const onCreate = async () => {
  createDialog.value?.show()
}

const onCreateSave = (id: string) => {
  selectedRepo.value = { uuid: id } as DocumentBase
  loadDocRepos()
}

const onDeleteRepo = (docRepo: DocumentBase) => {
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteRepository'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.docrepo.delete(docRepo.uuid)
    }
  })
}

const onConfig = () => {
  configDialog.value.show()
}

const startEditingTitle = async () => {
  if (!selectedRepo.value) return
  editingTitle.value = selectedRepo.value.name
  isEditingTitle.value = true
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

const saveTitle = () => {
  if (!selectedRepo.value || !editingTitle.value.trim()) return
  window.api.docrepo.update(selectedRepo.value.uuid, editingTitle.value.trim(), selectedRepo.value.description)
  isEditingTitle.value = false
}

const cancelEditingTitle = () => {
  isEditingTitle.value = false
  editingTitle.value = ''
}

const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const onSearch = async () => {
  if (!selectedRepo.value) return
  
  try {
    const result = await Dialog.show({
      title: t('docRepo.search.title'),
      text: t('docRepo.search.text'),
      input: 'text',
      inputPlaceholder: t('docRepo.search.placeholder'),
      showCancelButton: true,
    })

    if (!result.isConfirmed || !result.value?.trim()) {
      return
    }
    
    const searchResults = await window.api.docrepo.query(selectedRepo.value.uuid, result.value.trim())
    if (!searchResults || searchResults.length === 0) {
      await Dialog.show({
        title: t('docRepo.search.title'),
        text: t('docRepo.search.noResults')
      })
      return
    }

    const resultsHtml = searchResults.map((result: any) => {

      let html = `<div class="search-result-item">`
        
      if (result.metadata?.title) {
        html += '<div class="result-title">'
        if (result.metadata.url) {
          html += `<a href="${result.metadata?.url || '#'}" target="_blank" rel="noopener noreferrer">`
        }
        html += escapeHtml(result.metadata.title)
        if (result.metadata.url) {
          html += `</a>`
        }
        html += `</div>`
      }

      html += `<div class="result-content">${escapeHtml(result.content)}</div>`

      if (result.score) {
        html += `<div class="result-metadata">`
        html += `<span class="score">${t('docRepo.search.score', { score: result.score.toFixed(3) })}</span>`
        html += `</div>`
      }
      
      html += `</div>`
      return html
    
    }).join('')
    
    await Dialog.show({
      title: t('docRepo.search.results', { count: searchResults.length }),
      html: `<div class="search-results-container">${resultsHtml}</div>`,
      customClass: {
        popup: 'search-results-dialog'
      }
    })

  } catch (error) {
    console.error('Search error:', error)
    await Dialog.show({
      title: t('docRepo.search.title'),
      text: t('docRepo.search.error')
    })
  }
}

</script>

<style scoped>

.split-pane {
  
  .sp-sidebar {
    flex-basis: 360px;
  }

  .sp-main {
    position: relative;

    header {

      border-bottom: none;

      .title-section {
        display: flex;
        align-items: center;
        flex: 1;
        
        .title-display {
          display: flex;
          align-items: center;
          gap: 1rem;

          .title {
            flex: 1;
          }
          
          .edit-title {
            opacity: 0;
            transition: opacity 0.2s;
            cursor: pointer;
          }

          &:hover {
            .edit-title {
              opacity: 0.5;
            }
          }
        }
        
        .title-edit {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
      }
    }

    main {
      border: none;
    }

  }
}


</style>

<style>
.search-results-dialog {
  width: 700px !important;
  max-width: 700px !important;
}

.search-results-dialog .swal2-html-container {
  max-height: 60vh;
  overflow-y: auto;
  padding: 2rem;
}

.search-results-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-result-item {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
  gap: 0.5rem;
  &:last-child {
    border-bottom: none;
  }
}

.search-result-item .result-title {
  font-weight: var(--font-weight-medium);
}

.search-result-item .result-metadata .score {
  color: var(--color-success);
  font-weight: var(--font-weight-regular);
}


</style>
