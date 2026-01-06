<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.chat') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="form-field">
        <label for="provider">{{ t('settings.computerUse.provider.label') }}</label>
        <select id="provider" name="provider" v-model="provider" @change="save">
          <option value="anthropic">{{ t('settings.computerUse.provider.anthropic') }}</option>
          <option value="google">{{ t('settings.computerUse.provider.google') }}</option>
        </select>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'

const provider = ref<'anthropic' | 'google'>('anthropic')

const load = () => {
  provider.value = store.config.computerUse.provider || 'anthropic'
}

const save = () => {
  store.config.computerUse.provider = provider.value
  store.saveSettings()
}

defineExpose({ load })

</script>

