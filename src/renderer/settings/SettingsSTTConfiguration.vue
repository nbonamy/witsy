<template>
  <div class="form form-vertical form-large">

    <div class="form-field language">
      <label>{{ t('settings.voice.spokenLanguage') }}</label>
      <LangSelect v-model="locale" default-text="settings.voice.automatic" @change="save" />
    </div>

    <div class="form-field vocabulary">
      <label>{{ t('settings.voice.customVocabulary.label') }}</label>
      <textarea v-model="vocabulary" name="vocabulary" @change="save" :placeholder="t('settings.voice.customVocabulary.placeholder')"></textarea>
    </div>

    <div class="form-field">
      <label>{{ t('settings.voice.silenceDetection') }}</label>
      <select name="duration" v-model="duration" @change="save">
        <option value="0">{{ t('settings.voice.silenceOptions.disabled') }}</option>
        <option value="1000">{{ t('settings.voice.silenceOptions.oneSecond') }}</option>
        <option value="2000">{{ t('settings.voice.silenceOptions.twoSeconds') }}</option>
        <option value="3000">{{ t('settings.voice.silenceOptions.threeSeconds') }}</option>
        <option value="4000">{{ t('settings.voice.silenceOptions.fourSeconds') }}</option>
        <option value="5000">{{ t('settings.voice.silenceOptions.fiveSeconds') }}</option>
      </select>
    </div>

  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import LangSelect from '@components/LangSelect.vue'

const locale = ref('')
const vocabulary = ref('')
const duration = ref(null)

const load = () => {
  const detection = store.config.stt.silenceDetection
  duration.value = detection ? store.config.stt.silenceDuration || 2000 : 0
  vocabulary.value = store.config.stt.vocabulary.map(v => v.text).join('\n') || ''
  locale.value = store.config.stt.locale || ''
}

const save = () => {
  store.config.stt.locale = locale.value
  store.config.stt.vocabulary = vocabulary.value.split('\n').filter(line => line.trim().length > 0).map(line => ({ text: line.trim() }))
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>

.settings .form.form-vertical .form-field textarea {
  flex: 1 0 100px;
}

</style>
