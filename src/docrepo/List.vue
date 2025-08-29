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
          <div class="icon trailing">
            <ChevronRightIcon v-if="selectedRepo?.uuid === repo.uuid" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from 'lucide-vue-next';
import { DocumentBase } from '../types/rag';

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
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem;
}

.list-item {
  padding: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}


.list-item.selected {
  background-color: var(--split-pane-sidebar-list-item-selected-bg-color) !important;
  color: var(--split-pane-sidebar-list-item-selected-text-color) !important;
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
