<template>
  <div class="form form-vertical form-large">

    <div class="form-field">
      <label>{{ t('settings.voice.quickDictation.appearance') }}</label>
      <select name="appearance" v-model="appearance" @change="save">
        <option value="bottom">{{ t('settings.voice.quickDictation.appearanceBottom') }}</option>
        <option value="top">{{ t('settings.voice.quickDictation.appearanceTop') }}</option>
        <option value="notch">{{ t('settings.voice.quickDictation.appearanceNotch') }}</option>
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

import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'

const appearance = ref<'bottom' | 'top' | 'notch'>('bottom')
const copyToClipboard = ref(false)

const load = () => {
  const config = store.config.stt.quickDictation
  appearance.value = config?.appearance ?? 'bottom'
  copyToClipboard.value = config?.copyToClipboard ?? false
}

const save = () => {
  if (!store.config.stt.quickDictation) {
    store.config.stt.quickDictation = {
      appearance: 'bottom',
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
