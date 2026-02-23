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
        <List :docRepos="docRepos || []" :selectedRepo="selectedRepo" @selectRepo="selectRepo" @rename="onRenameRepo" @delete="onDeleteRepo" @create="onCreate" @config="onConfig" />
      </main>
      <footer>
        <button class="new-collection cta" @click="onCreate"><FolderPlusIcon /> {{ t('docRepo.create.title') }}</button>
      </footer>
    </div>
    <div class="sp-main">
      <header v-if="mode === 'view'">
        <div class="title-section">
          <div class="title-display">
            <span class="title">{{ selectedRepo?.name }}</span>
            <ButtonIcon class="edit-title" v-tooltip="{ text: t('common.rename'), position: 'bottom' }" @click="onRenameRepo(selectedRepo)">
              <PencilIcon />
            </ButtonIcon>
          </div>
        </div>
        <ButtonIcon class="search" v-tooltip="{ text: t('docRepo.search.title'), position: 'bottom-left' }" @click="onSearch">
          <SearchIcon />
        </ButtonIcon>
        <ButtonIcon v-if="scanning">
          <SpinningIcon :spinning="true" />
        </ButtonIcon>
        <ButtonIcon class="scan" v-tooltip="{ text: t('docRepo.view.tooltips.scanForChanges'), position: 'bottom-left' }" @click="onScanForChanges" v-else>
          <FolderSyncIcon />
        </ButtonIcon>
        <ButtonIcon class="delete" v-tooltip="{ text: t('docRepo.list.tooltips.delete'), position: 'bottom-left' }" @click="onDeleteRepo(selectedRepo)">
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

import { DocReposViewParams } from '@/types'
import ButtonIcon from '@components/ButtonIcon.vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import useIpcListener from '@composables/ipc_listener'
import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { FolderPlusIcon, FolderSyncIcon, PencilIcon, SearchIcon, Settings2Icon, Trash2 } from 'lucide-vue-next'
import { DocumentBase } from 'types/rag'
import { nextTick, onMounted, ref, watch } from 'vue'
import Config from '../docrepo/Config.vue'
import Create from '../docrepo/Create.vue'
import Empty from '../docrepo/Empty.vue'
import List from '../docrepo/List.vue'
import View from '../docrepo/View.vue'

const { onIpcEvent } = useIpcListener()

type DocRepoMode = 'list' | 'view'

const mode = ref<DocRepoMode>('list')
const docRepos = ref(null)
const selectedRepo = ref<DocumentBase | null>(null)
const configDialog = ref(null)
const createDialog = ref(null)
const scanning = ref(false)


const props = defineProps({
  extra: Object as () => DocReposViewParams | undefined
})

const processAction = async (params: DocReposViewParams) => {
  if (!params.action) return

  switch (params.action) {
    case 'create':
      await nextTick()
      onCreate()
      break

    case 'select':
      if (params.repoId) {
        await nextTick()
        loadDocRepos()
        const repo = docRepos.value?.find((r: DocumentBase) => r.uuid === params.repoId)
        if (repo) {
          selectRepo(repo)
        }
      }
      break

    case 'search':
      if (params.repoId) {
        await nextTick()
        loadDocRepos()
        const repo = docRepos.value?.find((r: DocumentBase) => r.uuid === params.repoId)
        if (repo) {
          selectRepo(repo)
          await nextTick()
          onSearch()
        }
      }
      break

    case 'addDocument':
      if (params.repoId) {
        await nextTick()
        loadDocRepos()
        const repo = docRepos.value?.find((r: DocumentBase) => r.uuid === params.repoId)
        if (repo) {
          selectRepo(repo)
          // Add document functionality would be triggered here
          // This depends on the View component's API
        }
      }
      break
  }
}

onMounted(async () => {
  onIpcEvent('docrepo-modified', loadDocRepos)
  loadDocRepos()

  // Watch for viewParams actions
  watch(() => props.extra, (params) => {
    if (params?.action) {
      processAction(params)
    }
  }, { immediate: true })
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

const onRenameRepo = async (docRepo: DocumentBase) => {
  const { value: name } = await Dialog.show({
    title: t('common.rename'),
    input: 'text',
    inputValue: docRepo.name,
    confirmButtonText: t('common.rename'),
    showCancelButton: true,
  })
  if (name) {
    window.api.docrepo.update(docRepo.uuid, name.trim(), docRepo.description)
  }
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

const onScanForChanges = async () => {
  if (!selectedRepo.value || scanning.value) return

  const hasWebSources = selectedRepo.value.documents.some(
    doc => doc.type === 'url' || doc.type === 'sitemap'
  )

  let forceWebRescan = false

  if (hasWebSources) {
    const result = await Dialog.show({
      target: document.querySelector('.docrepos'),
      title: t('docRepo.scan.title'),
      text: t('docRepo.scan.text'),
      confirmButtonText: t('common.continue'),
      showDenyButton: true,
      denyButtonText: t('docRepo.scan.filesOnly'),
      showCancelButton: true,
    })
    if (result.isDismissed) return
    forceWebRescan = result.isConfirmed
  }

  scanning.value = true
  try {
    await window.api.docrepo.scanForUpdates(selectedRepo.value.uuid, forceWebRescan)
  } catch (error) {
    console.error('Error scanning for changes:', error)
  } finally {
    scanning.value = false
  }
}

const onConfig = () => {
  configDialog.value.show()
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

.search-results-dialog .modal-body {
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
