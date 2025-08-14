<template>
  <FullScreenDrawer ref="drawer" @closed="emit('close')">
    <Empty v-if="!docRepos?.length && !selectedRepo" @click="onCreate" @close="onClose" />
    <div v-else class="docrepo split-pane">
      <div class="sp-sidebar">
        <header>
          <div class="title">{{ t('docRepo.list.title') }}</div>
          <BIconSliders class="icon config" v-tooltip="{ text: t('docRepo.list.tooltips.config'), position: 'left' }" @click="onConfig" />
        </header>
        <main>
          <List :docRepos="docRepos || []" :selectedRepo="selectedRepo" @selectRepo="selectRepo" @create="onCreate" @config="onConfig" />
        </main>
        <footer>
          <button class="new-collection cta with-icon" @click="onCreate"><BIconPlusLg /> {{ t('docRepo.create.title') }}</button>
        </footer>
      </div>
      <div class="sp-main">
      <header v-if="mode === 'view'">
        <div class="title-section">
          <div v-if="!isEditingTitle" class="title-display">
            <span class="title">{{ selectedRepo?.name }}</span>
            <BIconPencil 
              class="icon edit-title" 
              v-tooltip="{ text: t('common.edit'), position: 'bottom' }"
              @click="startEditingTitle" 
            />
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
              <BIconCheck 
                class="icon save" 
                v-tooltip="{ text: t('common.save'), position: 'bottom' }"
                @click="saveTitle" 
              />
              <BIconX 
                class="icon cancel" 
                v-tooltip="{ text: t('common.cancel'), position: 'bottom' }"
                @click="cancelEditingTitle" 
              />
            </div>
          </div>
        </div>
        <BIconTrash
          class="icon delete" 
          v-tooltip="{ text: t('docRepo.list.tooltips.delete'), position: 'bottom-left' }"
          @click="onDeleteRepo(selectedRepo)"
        />
        <BIconXLg
          class="icon close" 
          v-tooltip="{ text: t('common.close'), position: 'bottom-left' }"
          @click="onClose"
        />
      </header>
        <View :selectedRepo="selectedRepo" v-if="mode === 'view'"/>
      </div>
      <Config ref="configDialog" />
    </div>
    <Create ref="createDialog" @save="onCreateSave" />
  </FullScreenDrawer>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { DocumentBase } from '../types/rag'
import { store } from '../services/store'
import { t } from '../services/i18n'
import FullScreenDrawer from '../components/FullScreenDrawer.vue'
import Dialog from '../composables/dialog'
import Config from '../docrepo/Config.vue'
import List from '../docrepo/List.vue'
import View from '../docrepo/View.vue'
import Create from '../docrepo/Create.vue'
import Empty from '../docrepo/Empty.vue'

// bus
import useEventBus from '../composables/event_bus'
import { BIconXLg } from 'bootstrap-icons-vue'
const { onEvent } = useEventBus()

type DocRepoMode = 'list' | 'view'

const drawer = ref<typeof FullScreenDrawer|null>(null)
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

onUnmounted(() => {
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
  window.api.docrepo.rename(selectedRepo.value.uuid, editingTitle.value.trim())
  isEditingTitle.value = false
}

const cancelEditingTitle = () => {
  isEditingTitle.value = false
  editingTitle.value = ''
}

const emit = defineEmits(['close'])

const onClose = () => {
  drawer.value?.close()
}

</script>

<style scoped>

.split-pane {
  .sp-sidebar {
    flex-basis: 360px;
  }

  .sp-main {
    position: relative;
  }

  header {
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
}

</style>
