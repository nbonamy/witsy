<template>
  <div class="form form-vertical form-large">
    <div class="description">
      {{ t('settings.plugins.browse.description') }}
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="browse-enabled" name="enabled" v-model="enabled" @change="save" />
      <label for="browse-enabled">{{ t('common.enabled') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

const enabled = ref(false)

const load = () => {
  enabled.value = store.config.plugins.browse.enabled || false
}

const save = () => {
  store.config.plugins.browse.enabled = enabled.value
  store.saveSettings()
}

defineExpose({ load })

</script>


