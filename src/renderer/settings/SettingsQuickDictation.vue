<template>
  <div class="form form-vertical form-large">

    <div class="form-field">
      <label>{{ t('settings.voice.quickDictation.appearance') }}</label>
      <select name="appearance" v-model="appearance" @change="save">
        <option value="panel">{{ t('settings.voice.quickDictation.appearancePanel') }}</option>
        <option v-if="canUseNotch" value="notch">{{ t('settings.voice.quickDictation.appearanceNotch') }}</option>
      </select>
    </div>

    <div class="form-field horizontal">
      <input type="checkbox" id="copy-to-clipboard" v-model="copyToClipboard" @change="save" />
      <label for="copy-to-clipboard" class="no-colon">{{ t('settings.voice.quickDictation.copyToClipboard') }}</label>
    </div>

    <div class="hint" v-html="t('settings.voice.quickDictation.escapeHint')"></div>

  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'

const appearance = ref<'panel' | 'notch'>('panel')
const copyToClipboard = ref(false)

// Only show notch option on macOS
const canUseNotch = computed(() => {
  return window.api.platform === 'darwin'
})

const load = () => {
  const config = store.config.stt.quickDictation
  appearance.value = config?.appearance ?? 'panel'
  copyToClipboard.value = config?.copyToClipboard ?? false
}

const save = () => {
  if (!store.config.stt.quickDictation) {
    store.config.stt.quickDictation = {
      appearance: 'panel',
      copyToClipboard: false
    }
  }
  store.config.stt.quickDictation.appearance = appearance.value
  store.config.stt.quickDictation.copyToClipboard = copyToClipboard.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>

.hint {
  margin-top: 16px;
  font-size: 13px;
  color: var(--faded-text-color);
}

</style>
