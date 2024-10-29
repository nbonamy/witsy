<template>
  <dialog class="editor" id="docrepoconfig">
    <form method="dialog">
      <header>
        <div class="title">Document Repositories defaults</div>
      </header>
      <main>
        <div class="group">
          <label>Max document size</label>
          <input v-model="maxDocumentSizeMB" />&nbsp;&nbsp;million characters
        </div>
        <div class="group">
          <label>Chunk size</label>
          <input v-model="chunkSize" />&nbsp;&nbsp;characters
        </div>
        <div class="group">
          <label>Chunk overlap</label>
          <input v-model="chunkOverlap" />&nbsp;&nbsp;characters
        </div>
        <div class="group">
          <label>Search result count</label>
          <input v-model="searchResultCount" />
        </div>
        <div class="group">
          <label>Search relevance cut-off</label>
          <input v-model="relevanceCutOff" />&nbsp;&nbsp;0 ≤ x ≤ 1
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button @click.prevent="onReset" formnovalidate>Reset</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

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
