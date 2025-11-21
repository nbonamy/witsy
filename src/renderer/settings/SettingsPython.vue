<template>
  <div class="form form-vertical form-large">
    <div class="description">
      <b>{{ t('settings.plugins.python.warning') }}</b> {{ t('settings.plugins.python.description1') }}
      {{ t('settings.plugins.python.description2') }}
      <b>{{ t('settings.plugins.python.useAtOwnRisk') }}</b>!
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="python-enabled" v-model="enabled" @change="save" :disabled="isDownloading" />
      <label for="python-enabled">{{ t('common.enabled') }}</label>
    </div>
    <div class="form-field">
      <label>{{ t('settings.plugins.python.runtime') }}</label>
      <select name="runtime" v-model="runtime" @change="save">
        <option value="embedded">{{ t('settings.plugins.python.embeddedRuntime') }}</option>
        <option value="native">{{ t('settings.plugins.python.nativeRuntime') }}</option>
      </select>
      <div class="help">
        {{ runtime === 'embedded' ? t('settings.plugins.python.embeddedDescription') : t('settings.plugins.python.nativeDescription') }}
      </div>
      <div class="download" v-if="enabled && runtime === 'embedded'">
        <template v-if="!isDownloading">
          <button v-if="!downloaded" @click.prevent="downloadPyodide">
            {{ t('common.download') }}
          </button>
          <button v-else @click.prevent="uninstallPyodide">
            {{ t('settings.plugins.python.uninstallLabel') }}
          </button>
        </template>
        <template v-else>
          <SpinningIcon :spinning="true" size="sm" class="download-spinner" />
          <span class="download-status">{{ t('settings.plugins.python.downloading') }}</span>
        </template>
      </div>
    </div>
    <div class="form-field" v-if="runtime === 'native'">
      <label>{{ t('settings.plugins.python.binaryPath') }}</label>
      <div class="form-subgroup">
        <input type="text" v-model="binpath" @change="save">
        <div class="actions">
          <button @click.prevent="search" class="search">{{ t('settings.plugins.python.search') }}</button>
          <button @click.prevent="pick">{{ t('common.pick') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { store } from '@services/store'

const enabled = ref(false)
const runtime = ref('embedded')
const binpath = ref(null)
const downloaded = ref(false)
const isDownloading = ref(false)

const load = async () => {
  enabled.value = store.config.plugins.python.enabled || false
  runtime.value = store.config.plugins.python.runtime || 'embedded'
  binpath.value = store.config.plugins.python.binpath || ''
  downloaded.value = await window.api.interpreter.isPyodideCached()
}

const promptDownloadIfNeeded = async () => {
  // Only prompt if enabling and using embedded runtime
  if (!enabled.value || runtime.value !== 'embedded') {
    return
  }

  // Check if already cached
  const isCached = await window.api.interpreter.isPyodideCached()
  if (isCached) {
    return
  }

  // Show confirmation dialog
  const result = await Dialog.show({
    title: t('settings.plugins.python.downloadTitle'),
    text: t('settings.plugins.python.downloadMessage'),
    showCancelButton: true,
    confirmButtonText: t('settings.plugins.python.downloadNow'),
    cancelButtonText: t('settings.plugins.python.downloadLater'),
  })

  if (result.isConfirmed) {
    downloadPyodide()
  }
}

const downloadPyodide = async () => {

  // Show inline downloading state
  isDownloading.value = true

  try {
    const downloadResult = await window.api.interpreter.downloadPyodide()

    isDownloading.value = false

    if (downloadResult.success) {
      await Dialog.alert(t('settings.plugins.python.downloadSuccess'))
      downloaded.value = true
    } else {
      await Dialog.alert(t('settings.plugins.python.downloadError', { error: downloadResult.error }))
    }
  } catch (error) {
    isDownloading.value = false
    await Dialog.alert(t('settings.plugins.python.downloadError', { error: error.message }))
  }
}

const uninstallPyodide = async () => {

  const rc = await Dialog.show({
    title: t('settings.plugins.python.uninstallTitle'),
    text: t('settings.plugins.python.uninstallMessage'),
    showCancelButton: true,
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.cancel'),
  })

  if (rc.isConfirmed) {
    await window.api.interpreter.clearPyodideCache()
    downloaded.value = false
  }
}

const search = () => {
  const path = window.api.file.find('python3')
  if (path) {
    binpath.value = path
    save()
  }
}

const pick = () => {
  const path = window.api.file.pickFile({ location: true })
  if (path) {
    binpath.value = path
    save()
  }
}

const save = async () => {
  store.config.plugins.python.enabled = enabled.value
  store.config.plugins.python.runtime = runtime.value
  store.config.plugins.python.binpath = binpath.value
  store.saveSettings()

  // Prompt for download if needed
  await promptDownloadIfNeeded()
}

defineExpose({ load })

</script>


<style scoped>

.download {
  padding-top: 1rem;
  display: flex;
  align-items: center;
}

.download-spinner {
  margin-left: 8px;
  color: var(--icon-color);
}

.download-status {
  margin-left: 6px;
  font-size: 12.5px;
  color: var(--icon-color);
}

</style>