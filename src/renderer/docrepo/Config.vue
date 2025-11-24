<template>
  <ModalDialog id="docrepo-config" ref="dialog" @save="onSave" width="32rem">
    <template #header>
      {{ t('docRepo.config.title') }}
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('docRepo.config.maxDocumentSize') }}</label>
        <div class="input-with-suffix">
          <input name="maxDocumentSizeMB" v-model="maxDocumentSizeMB" />
          <span class="suffix">{{ t('docRepo.config.millionCharacters') }}</span>
        </div>
      </div>
      
      <div class="form-field">
        <label>{{ t('docRepo.config.chunkSize') }}</label>
        <div class="input-with-suffix">
          <input name="chunkSize" v-model="chunkSize" />
          <span class="suffix">{{ t('docRepo.config.characters') }}</span>
        </div>
      </div>
      
      <div class="form-field">
        <label>{{ t('docRepo.config.chunkOverlap') }}</label>
        <div class="input-with-suffix">
          <input name="chunkOverlap" v-model="chunkOverlap" />
          <span class="suffix">{{ t('docRepo.config.characters') }}</span>
        </div>
      </div>
      
      <div class="form-field">
        <label>{{ t('docRepo.config.relevanceCutOff') }}</label>
        <div class="input-with-suffix">
          <input name="relevanceCutOff" v-model="relevanceCutOff" />
          <span class="suffix">0 ≤ x ≤ 1</span>
        </div>
      </div>

      <div class="form-field">
        <label>{{ t('docRepo.config.searchResultCount') }}</label>
        <div class="input-with-suffix">
          <input name="searchResultCount" v-model="searchResultCount" />
          <span class="suffix">&nbsp;</span>
        </div>
      </div>
      
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="reset" @click="onReset" class="secondary" formnovalidate>{{ t('common.reset') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import ModalDialog from '@components/ModalDialog.vue'
import defaultSettings from '@root/defaults/settings.json'

const dialog = ref(null)
const maxDocumentSizeMB = ref(null)
const chunkSize = ref(null)
const chunkOverlap = ref(null)
const searchResultCount = ref(null)
const relevanceCutOff = ref(null)

onMounted(() => {
})

const show = () => {
  load()
  dialog.value?.show()
}

const close = () => {
  dialog.value.close()
}

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
  close()
}

const onCancel = () => {
  close()
}

defineExpose({ show, close })

</script>

<style>

#docrepo-config .input-with-suffix {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
}

#docrepo-config .input-with-suffix input {  
  text-align: right;
  flex: 1;
}

#docrepo-config .suffix {
  color: var(--text-color);
  font-size: 0.9rem;
  flex: 1;
  text-align: left;
}

</style>