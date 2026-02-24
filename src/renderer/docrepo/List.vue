<template>
  <div class="docrepo-list">
    <div class="list-body" v-if="docRepos.length">
      <template v-for="repo in docRepos" :key="repo.uuid">
        <div class="list-item" :class="{ selected: props.selectedRepo?.uuid === repo.uuid }" @click="selectRepo(repo)" @contextmenu.prevent="showContextMenu($event, repo)">
          <div class="icon leading">
            <FolderOpenIcon v-if="selectedRepo?.uuid === repo.uuid" />
            <FolderIcon v-else />
          </div>
          <div class="info">
            <div class="text">{{ repo.name }}</div>
          </div>
          <Spinner v-if="processingBases.includes(repo.uuid)" />
          <ButtonIcon class="trailing" v-if="selectedRepo?.uuid === repo.uuid">
            <ChevronRightIcon />
          </ButtonIcon>
        </div>
      </template>
    </div>
    <ContextMenuPlus v-if="showMenu" @close="closeContextMenu" :mouseX="menuX" :mouseY="menuY">
      <div class="item" @click="handleActionClick('rename')"><PencilIcon class="icon" />{{ t('common.rename') }}</div>
      <div class="item danger" @click="handleActionClick('delete')"><Trash2Icon class="icon" />{{ t('common.delete') }}</div>
    </ContextMenuPlus>
  </div>
</template>

<script setup lang="ts">
import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import Spinner from '@components/Spinner.vue'
import { useDocRepoEvents } from '@composables/useDocRepoEvents'
import { t } from '@services/i18n'
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, PencilIcon, Trash2Icon } from 'lucide-vue-next'
import { DocumentBase } from 'types/rag'
import { ref } from 'vue'

// use composable for IPC events
const { processingBases } = useDocRepoEvents('base')

// props
const props = defineProps<{
  docRepos: DocumentBase[]
  selectedRepo: DocumentBase | null
}>()

// emits
const emit = defineEmits<{
  selectRepo: [repo: DocumentBase]
  rename: [repo: DocumentBase]
  delete: [repo: DocumentBase]
  create: []
  config: []
}>()

// context menu state
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRepo = ref<DocumentBase | null>(null)

const selectRepo = (repo: DocumentBase) => {
  emit('selectRepo', repo)
}

const showContextMenu = (event: MouseEvent, repo: DocumentBase) => {
  showMenu.value = true
  targetRepo.value = repo
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false
}

const handleActionClick = (action: string) => {
  closeContextMenu()

  const repo = targetRepo.value
  if (!repo) return

  if (action === 'rename') {
    emit('rename', repo)
  } else if (action === 'delete') {
    emit('delete', repo)
  }
}

</script>

<style scoped>

.docrepo-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-body {
  margin-top: 0.5rem;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-item {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.5rem;
  height: 2.5rem;
}


.list-item.selected {
  background-color: var(--sidebar-selected-color) !important;
  color: var(--text-color) !important;
  border-radius: 8px;
}

.list-item .info {
  flex: 1;
}

.list-item .info .text {
  font-weight: var(--font-weight-regular);
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  line-clamp: 1;
}

.list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  opacity: 0.7;
  padding: 2rem;
}

</style>
