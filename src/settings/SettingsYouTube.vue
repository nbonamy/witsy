<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.youtube.description') }}
    </div>
    <div class="group horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

const enabled = ref(false)

const load = () => {
  enabled.value = store.config.plugins.youtube.enabled || false
}

const save = () => {
  store.config.plugins.youtube.enabled = enabled.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

