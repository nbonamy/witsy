<template>
  <dialog class="editor" id="docrepoconfig">
    <form method="dialog">
      <header>
        <div class="title">{{ t('docRepo.config.title') }}</div>
      </header>
      <main>
        <div class="group">
          <label>{{ t('docRepo.config.maxDocumentSize') }}</label>
          <input v-model="maxDocumentSizeMB" />&nbsp;&nbsp;{{ t('docRepo.config.millionCharacters') }}
        </div>
        <div class="group">
          <label>{{ t('docRepo.config.chunkSize') }}</label>
          <input v-model="chunkSize" />&nbsp;&nbsp;{{ t('docRepo.config.characters') }}
        </div>
        <div class="group">
          <label>{{ t('docRepo.config.chunkOverlap') }}</label>
          <input v-model="chunkOverlap" />&nbsp;&nbsp;{{ t('docRepo.config.characters') }}
        </div>
        <div class="group">
          <label>{{ t('docRepo.config.searchResultCount') }}</label>
          <input v-model="searchResultCount" />
        </div>
        <div class="group">
          <label>{{ t('docRepo.config.relevanceCutOff') }}</label>
          <input v-model="relevanceCutOff" />&nbsp;&nbsp;0 ≤ x ≤ 1
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">{{ t('common.save') }}</button>
        <button @click.prevent="onReset" formnovalidate>{{ t('common.reset') }}</button>
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import defaultSettings from '../../defaults/settings.json'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const maxDocumentSizeMB = ref(null)
const chunkSize = ref(null)
const chunkOverlap = ref(null)
const searchResultCount = ref(null)
const relevanceCutOff = ref(null)

onMounted(() => {
  onEvent('open-docrepo-config', onOpen)
})

const onOpen = () => {
  document.querySelector<HTMLDialogElement>('#docrepoconfig').showModal()
  maxDocumentSizeMB.value = store.config.rag.maxDocumentSizeMB
  chunkSize.value = store.config.rag.chunkSize
  chunkOverlap.value = store.config.rag.chunkOverlap
  searchResultCount.value = store.config.rag.searchResultCount
  relevanceCutOff.value = store.config.rag.relevanceCutOff
}

const onReset = () => {
  maxDocumentSizeMB.value = defaultSettings.rag.maxDocumentSizeMB
  chunkSize.value = defaultSettings.rag.chunkSize
  chunkOverlap.value = defaultSettings.rag.chunkOverlap
  searchResultCount.value = defaultSettings.rag.searchResultCount
  relevanceCutOff.value = defaultSettings.rag.relevanceCutOff
}

const onSave = () => {
  store.config.rag.maxDocumentSizeMB = maxDocumentSizeMB.value
  store.config.rag.chunkSize = chunkSize.value
  store.config.rag.chunkOverlap = chunkOverlap.value
  store.config.rag.searchResultCount = searchResultCount.value
  store.config.rag.relevanceCutOff = relevanceCutOff.value
  store.saveSettings()
}

const onCancel = () => {
  document.querySelector<HTMLDialogElement>('#docrepoconfig').close()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>

<style scoped>
#docrepoconfig .group label {
  min-width: 225px;
}

#docrepoconfig .group input {
  max-width: 50px;
  text-align: right;
}
</style>