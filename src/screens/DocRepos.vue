<template>
  <Empty v-if="!docRepos?.length && !selectedRepo" @click="onCreate"/>
  <div v-else class="docrepo split-pane" v-bind="$attrs">
    <div class="sp-sidebar">
      <header>
        <div class="title">{{ t('docRepo.list.title') }}</div>
        <BIconSliders class="icon config" v-tooltip="{ text: t('docRepo.list.tooltips.config'), position: 'bottom-left' }" @click="onConfig" />
      </header>
      <main>
        <List :docRepos="docRepos || []" :selectedRepo="selectedRepo" @selectRepo="selectRepo" @create="onCreate" @config="onConfig" />
      </main>
      <footer>
        <button class="new-collection" @click="onCreate"><BIconPlusLg /> {{ t('docRepo.create.title') }}</button>
      </footer>
    </div>
    <div class="sp-main">
      <header v-if="mode === 'view'">
        <div class="title">{{ selectedRepo?.name }}</div>
        <BIconTrash 
          class="icon delete" 
          v-tooltip="{ text: t('docRepo.list.tooltips.delete'), position: 'bottom-left' }"
          @click="onDeleteRepo(selectedRepo)" 
        />
      </header>
      <View :selectedRepo="selectedRepo" @rename="onChangeRepoName" v-if="mode === 'view'"/>
    </div>
    <Config ref="configDialog" />
  </div>
  <Create ref="createDialog" @save="onCreateSave" />
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue'
import { DocumentBase } from '../types/rag'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import Config from '../docrepo/Config.vue'
import List from '../docrepo/List.vue'
import View from '../docrepo/View.vue'
import Create from '../docrepo/Create.vue'
import Empty from '../docrepo/Empty.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

type DocRepoMode = 'list' | 'view'

const mode = ref<DocRepoMode>('list')
const docRepos = ref(null)
const selectedRepo = ref<DocumentBase | null>(null)
const configDialog = ref(null)
const createDialog = ref(null)

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

const onChangeRepoName = (event: Event) => {
  if (!selectedRepo.value) return
  window.api.docrepo.rename(selectedRepo.value.uuid, (event.target as HTMLInputElement).value)
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
}

</style>
