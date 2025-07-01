<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.filesystem.description') }}
    </div>
    <div class="group horizontal">
      <input type="checkbox" name="enabled" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>
    <div class="group vertical" v-if="enabled">
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
          <button class="button add" @click="addPath"><BIconPlus /></button>
          <button class="button remove" @click="removePath" :disabled="selectedPath === null"><BIconDash /></button>
        </div>
      </div>
      <div class="note">
        {{ t('settings.plugins.filesystem.pathsNote') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'

const enabled = ref(false)
const allowedPaths = ref<string[]>([])
const selectedPath = ref<number | null>(null)

const load = () => {
  enabled.value = store.config.plugins.filesystem?.enabled || false
  allowedPaths.value = store.config.plugins.filesystem?.allowedPaths || []
  selectedPath.value = null
}

const save = () => {
  store.config.plugins.filesystem.enabled = enabled.value
  store.config.plugins.filesystem.allowedPaths = allowedPaths.value.filter(path => path.trim() !== '')
  store.saveSettings()
}

const selectPath = (index: number) => {
  selectedPath.value = index
}

const addPath = async () => {
  const path = await window.api.file.pickDir()
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
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';

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