<template>
  
  <form class="docrepo-config large vertical" @submit.prevent>
    
    <div class="group">
      <label>{{ t('docRepo.config.maxDocumentSize') }}</label>
      <div class="input-with-suffix">
        <input name="maxDocumentSizeMB" v-model="maxDocumentSizeMB" />
        <span class="suffix">{{ t('docRepo.config.millionCharacters') }}</span>
      </div>
    </div>
    
    <div class="group">
      <label>{{ t('docRepo.config.chunkSize') }}</label>
      <div class="input-with-suffix">
        <input name="chunkSize" v-model="chunkSize" />
        <span class="suffix">{{ t('docRepo.config.characters') }}</span>
      </div>
    </div>
    
    <div class="group">
      <label>{{ t('docRepo.config.chunkOverlap') }}</label>
      <div class="input-with-suffix">
        <input name="chunkOverlap" v-model="chunkOverlap" />
        <span class="suffix">{{ t('docRepo.config.characters') }}</span>
      </div>
    </div>
    
    <div class="group">
      <label>{{ t('docRepo.config.searchResultCount') }}</label>
      <input name="searchResultCount" v-model="searchResultCount" />
    </div>
    
    <div class="group">
      <label>{{ t('docRepo.config.relevanceCutOff') }}</label>
      <div class="input-with-suffix">
        <input name="relevanceCutOff" v-model="relevanceCutOff" />
        <span class="suffix">0 ≤ x ≤ 1</span>
      </div>
    </div>

    <div class="buttons">
      <button type="submit" class="default" @click="onSave">{{ t('common.save') }}</button>
      <button type="button" class="reset" @click="onReset" formnovalidate>{{ t('common.reset') }}</button>
      <button type="button" class="cancel" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
    </div>

  </form>

</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import defaultSettings from '../../defaults/settings.json'

const emit = defineEmits(['close'])

const maxDocumentSizeMB = ref(null)
const chunkSize = ref(null)
const chunkOverlap = ref(null)
const searchResultCount = ref(null)
const relevanceCutOff = ref(null)

onMounted(() => {
  load()
})

const load = () => {
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
  store.config.rag.maxDocumentSizeMB = parseInt(maxDocumentSizeMB.value)
  store.config.rag.chunkSize = parseInt(chunkSize.value)
  store.config.rag.chunkOverlap = parseInt(chunkOverlap.value)
  store.config.rag.searchResultCount = parseInt(searchResultCount.value)
  store.config.rag.relevanceCutOff = parseFloat(relevanceCutOff.value)
  store.saveSettings()
  emit('close')
}

const onCancel = () => {
  load() // Reset values
  emit('close')
}

</script>

<style scoped>
@import '../../css/form.css';

.docrepo-config {

  padding: 4rem;
  width: 240px;
  margin: 0 auto;
  
  .input-with-suffix {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .input-with-suffix input {
    max-width: 100px;
    text-align: right;
  }
  
  .suffix {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  input[name="searchResultCount"] {
    max-width: 100px;
    text-align: right;
  }

  .buttons {
    justify-content: flex-start !important;
  }

}
</style>