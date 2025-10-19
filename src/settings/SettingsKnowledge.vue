<template>
  <div class="form form-vertical form-large">
    <div class="description">
      {{ t('settings.plugins.knowledge.description') }}
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="knowledge-enabled" name="enabled" v-model="enabled" @change="save" />
      <label for="knowledge-enabled">{{ t('common.enabled') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

const enabled = ref(false)

const load = () => {
  enabled.value = store.config.plugins.knowledge.enabled || false
}

const save = () => {
  store.config.plugins.knowledge.enabled = enabled.value
  store.saveSettings()
}

defineExpose({ load })

</script>

