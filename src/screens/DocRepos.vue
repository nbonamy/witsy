<template>
  <div class="docrepo split-pane" v-bind="$attrs">
    <div class="sp-main">
      <header v-if="mode === 'create'">
        <BIconChevronLeft class="icon back" @click="selectRepo(null)" />
        <div class="title">{{ t('docRepo.create.title') }}</div>
      </header>
      <header v-else-if="mode === 'config'">
        <BIconChevronLeft class="icon back" @click="selectRepo(null)" />
        <div class="title">{{ t('docRepo.config.title') }}</div>
      </header>
      <header v-else-if="mode === 'view'">
        <BIconChevronLeft class="icon back" @click="selectRepo(null)" />
        <div class="title">{{ selectedRepo?.name }}</div>
      </header>
      <header v-else>
        <div class="title">{{ t('docRepo.list.title') }}</div>
      </header>
      <main class="list sliding-root" :class="{ visible: mode === 'list' }">
        <List :docRepos="docRepos || []" @selectRepo="selectRepo" @create="onCreate" @config="onConfig" @delete="onDeleteRepo" />
      </main>
      <main class="sliding-pane" :class="{ visible: mode === 'view' }" @transitionend="onTransitionEnd">
        <View :selectedRepo="selectedRepo" @rename="onChangeRepoName" />
      </main>
      <main class="sliding-pane editor" :class="{ visible: mode === 'create' }" @transitionend="onTransitionEnd">
        <Create @cancel="onCreateCancel" @save="onCreateSave" />
      </main>
      <main class="sliding-pane editor" :class="{ visible: mode === 'config' }" @transitionend="onTransitionEnd">
        <Config @close="onConfigClose" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue'
import { DocumentBase } from '../types/rag'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import Config from '../docrepo/Config.vue'
import List from '../docrepo/List.vue'
import View from '../docrepo/View.vue'
import Create from '../docrepo/Create.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

type DocRepoMode = 'list' | 'view' | 'create' | 'config'

const mode = ref<DocRepoMode>('list')
const prevMode = ref<DocRepoMode>('list')
const docRepos = ref(null)
const selectedRepo = ref<DocumentBase | null>(null)

const onTransitionEnd = async () => {
  prevMode.value = null
  if (mode.value === 'list') {
    selectedRepo.value = null
  }
}

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
  const repos = window.api.docrepo?.list()
  docRepos.value = repos ?? []
  if (selectedRepoId) {
    selectRepo(docRepos.value.find((repo: DocumentBase) => repo.uuid == selectedRepoId))
  }
}

const selectRepo = (repo: DocumentBase | null) => {
  if (!repo) {
    prevMode.value = mode.value
    mode.value = 'list'
    // selected reset will be done in onTransitionEnd
  } else {
    selectedRepo.value = repo
    mode.value = 'view'
  }
}

const onCreate = async () => {
  mode.value = 'create'
}

const onCreateCancel = () => {
  selectRepo(null)
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
  mode.value = 'config'
}

const onConfigClose = () => {
  selectRepo(null)
}

const onChangeRepoName = (event: Event) => {
  if (!selectedRepo.value) return
  window.api.docrepo.rename(selectedRepo.value.uuid, (event.target as HTMLInputElement).value)
}

</script>

<style scoped>

.split-pane {
  
  .sp-main {
  
    position: relative;
  
    .sliding-pane {
      width: 100%;
    }

  }

}
</style>
