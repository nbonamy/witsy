<template>
  <div class="docrepo-list">
    <div class="list-body" v-if="docRepos.length">
      <template v-for="repo in docRepos" :key="repo.uuid">
        <div class="list-item" :class="{ selected: props.selectedRepo?.uuid === repo.uuid }" @click="selectRepo(repo)">
          <div class="icon leading">
            <FolderOpenIcon v-if="selectedRepo?.uuid === repo.uuid" />
            <FolderIcon v-else />
          </div>
          <div class="info">
            <div class="text">{{ repo.name }}</div>
          </div>
          <ButtonIcon class="trailing" v-if="selectedRepo?.uuid === repo.uuid">
            <ChevronRightIcon />
          </ButtonIcon>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from 'lucide-vue-next'
import { DocumentBase } from 'types/rag'
import ButtonIcon from '@components/ButtonIcon.vue'

// props  
const props = defineProps<{
  docRepos: DocumentBase[]
  selectedRepo: DocumentBase | null
}>()

// emits
const emit = defineEmits<{
  selectRepo: [repo: DocumentBase]
  create: []
  config: []
}>()

const selectRepo = (repo: DocumentBase) => {
  emit('selectRepo', repo)
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
  gap: 1rem;
}

.list-item {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2rem;
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
