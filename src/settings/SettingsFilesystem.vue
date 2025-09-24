<template>
  <div class="form form-vertical form-large">
    <div class="description">
      {{ t('settings.plugins.filesystem.description') }}
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" name="enabled" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>
    <template v-if="enabled">
      <div class="form-field horizontal">
        <input type="checkbox" name="enabled" v-model="allowWrite" @change="onAllowWrite" />
        <label>{{ t('settings.plugins.filesystem.allowWrite') }}</label>
      </div>
      <div class="form-field horizontal">
        <input type="checkbox" name="enabled" :disabled="!allowWrite" v-model="skipConfirmation" @change="onSkipConfirmation" />
        <label>{{ t('settings.plugins.filesystem.skipConfirmation') }}</label>
      </div>
      <div class="form-field form-vertical">
        <label>{{ t('settings.plugins.filesystem.allowedPaths') }}</label>
        <div class="list-with-actions">
          <div class="sticky-table-container">
            <table class="list">
              <tbody>
                <tr v-for="(path, index) in allowedPaths" :key="index" :class="{ selected: selectedPath === index }" @click="selectPath(index)">
                  <td>{{ path }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="actions">
            <button class="button add" @click.prevent="addPath"><PlusIcon /></button>
            <button class="button remove" @click.prevent="removePath" :disabled="selectedPath === null"><MinusIcon /></button>
          </div>
        </div>
        <div class="note">
          {{ t('settings.plugins.filesystem.pathsNote') }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">

import { MinusIcon, PlusIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { store } from '../services/store'

const enabled = ref(false)
const allowedPaths = ref<string[]>([])
const allowWrite = ref(false)
const skipConfirmation = ref(false)
const selectedPath = ref<number | null>(null)

const load = () => {
  enabled.value = store.config.plugins.filesystem?.enabled || false
  allowedPaths.value = store.config.plugins.filesystem?.allowedPaths || []
  allowWrite.value = store.config.plugins.filesystem?.allowWrite || false
  skipConfirmation.value = store.config.plugins.filesystem?.skipConfirmation || false
  selectedPath.value = null
}

const save = () => {
  store.config.plugins.filesystem.enabled = enabled.value
  store.config.plugins.filesystem.allowedPaths = allowedPaths.value.filter(path => path.trim() !== '')
  store.config.plugins.filesystem.allowWrite = allowWrite.value
  store.config.plugins.filesystem.skipConfirmation = skipConfirmation.value
  store.saveSettings()
}

const onAllowWrite = () => {
  if (!allowWrite.value) {
    skipConfirmation.value = false
  }
  save()
}

const onSkipConfirmation = async () => {

  if (!skipConfirmation.value) {
    save()
    return
  }

  const result = await Dialog.show({
    target: document.querySelector('.main'),
    title: t('settings.plugins.filesystem.skipConfirmationWarning.title'),
    text: t('settings.plugins.filesystem.skipConfirmationWarning.text'),
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
    showCancelButton: true,
  })
  
  if (result.isConfirmed) {
    skipConfirmation.value = true
  } else {
    skipConfirmation.value = false
  }

  save()

}

const selectPath = (index: number) => {
  selectedPath.value = index
}

const addPath = async () => {
  const path = await window.api.file.pickDirectory()
  if (path) {
    allowedPaths.value.push(path)
    save()
  }
}

const removePath = () => {
  if (selectedPath.value === null) return
  
  Dialog.show({
    target: document.querySelector('.main'),
    title: t('common.confirmation.delete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed && selectedPath.value !== null) {
      allowedPaths.value.splice(selectedPath.value, 1)
      selectedPath.value = null
      save()
    }
  })
}

defineExpose({ load })

</script>

<style scoped>

.list-with-actions {
  width: 100%;
}

.sticky-table-container {
  height: 150px;
}

.sticky-table-container td {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.note {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 8px;
  font-style: italic;
}
</style>