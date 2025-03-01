<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.vega.description') }}
    </div>
    <div class="group">
      <label>{{ t('common.enabled') }}</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

const enabled = ref(false)

const load = () => {
  enabled.value = store.config.plugins.vega.enabled || false
}

const save = () => {
  store.config.plugins.vega.enabled = enabled.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

