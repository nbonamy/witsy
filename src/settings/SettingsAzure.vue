<template>
  <div>
    <div class="description">
      {{ t('settings.engines.azure.description') }}
    </div>
    <div class="description">
      <button class="large" @click.prevent="createAzureConnection">{{ t('settings.engines.azure.create') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { t } from '../services/i18n'

const emit = defineEmits(['createCustom'])

const createAzureConnection = () => {
  emit('createCustom', 'azure')
}

const load = () => {
}

defineExpose({ load })

</script>

