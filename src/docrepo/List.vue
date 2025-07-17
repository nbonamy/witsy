<template>
  <div class="docrepo-list list-large-with-header">
    <div class="header">
      <label>{{ t('docRepo.repositories.title') }}</label>
      <BIconSliders class="icon config" @click="onConfig" />
      <BIconPlusLg class="icon create" @click="onCreate" />
    </div>
    <div class="list" v-if="docRepos.length">
      <template v-for="repo in docRepos" :key="repo.uuid">
        <div class="item" @click="selectRepo(repo)">
          <div class="icon leading">
            <BIconArchive />
          </div>
          <div class="info">
            <div class="text">{{ repo.name }}</div>
            <div class="subtext">{{ t('docRepo.repositories.documentsCount', { count: documentCount(repo) }) }}</div>
          </div>
          <div class="actions">
            <BIconSearch class="view" @click.prevent.stop="selectRepo(repo)" />
            <BIconTrash class="delete" @click.prevent.stop="onDelete(repo)" />
          </div>
        </div>
      </template>
    </div>
    <div class="empty" v-else>
      {{ t('docRepo.repositories.noRepositories') }}<br />{{ t('docRepo.repositories.clickToCreate') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentBase, DocumentSource } from '../types/rag'
import { t } from '../services/i18n'

// props
defineProps<{
  docRepos: DocumentBase[]
}>()

// emits
const emit = defineEmits<{
  selectRepo: [repo: DocumentBase]
  create: []
  config: []
  delete: [repo: DocumentBase]
}>()

const docSourceCount = (source: DocumentSource): number => {
  return (source.type === 'folder' ? 0 : 1) + (source.items?.reduce((acc, item) => acc + docSourceCount(item), 0) ?? 0)
}

const documentCount = (repo: DocumentBase): number => {
  return repo.documents.reduce((acc, doc) => acc + docSourceCount(doc), 0)
}

const selectRepo = (repo: DocumentBase) => {
  emit('selectRepo', repo)
}

const onCreate = () => {
  emit('create')
}

const onConfig = () => {
  emit('config')
}

const onDelete = (repo: DocumentBase) => {
  emit('delete', repo)
}


</script>

<style scoped>
@import '../../css/list-large-with-header.css';
</style>

<style scoped>

.docrepo-list {
  margin: 4rem auto;
  min-width: 800px;
}

</style>
