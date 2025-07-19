<template>
  <div class="docrepo-list panel">
    <div class="panel-header">
      <label>{{ t('docRepo.list.title') }}</label>
      <BIconSliders class="icon config" @click="onConfig" />
      <BIconPlusLg class="icon create" @click="onCreate" />
    </div>
    <div class="panel-body" v-if="docRepos.length">
      <template v-for="repo in docRepos" :key="repo.uuid">
        <div class="panel-item" @click="selectRepo(repo)">
          <div class="icon leading">
            <BIconArchive />
          </div>
          <div class="info">
            <div class="text">{{ repo.name }}</div>
            <div class="subtext">{{ t('docRepo.list.documentsCount', { count: documentCount(repo) }) }}</div>
          </div>
          <div class="actions">
            <BIconSearch class="view" @click.prevent.stop="selectRepo(repo)" />
            <BIconTrash class="delete" @click.prevent.stop="onDelete(repo)" />
          </div>
        </div>
      </template>
    </div>
    <div class="panel-empty" v-else>
      {{ t('docRepo.list.noRepositories') }}<br />{{ t('docRepo.list.clickToCreate') }}
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

.docrepo-list {
  margin: 4rem auto;
  min-width: 800px;
}

</style>
