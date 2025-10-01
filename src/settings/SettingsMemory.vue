<template>
  <div class="form form-vertical form-large">
    <div class="description">
      {{ t('settings.plugins.memory.description') }}
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="memory-enabled" v-model="enabled" :disabled="!ready" @change="save" />
      <label for="memory-enabled">{{ t('common.enabled') }}</label>
    </div>
    <EmbeddingSelector v-if="!hasFacts" :disabled="hasFacts" v-model:engine="engine" v-model:model="model" @update="save"/>
    <div v-else class="form-field">
      <label></label>
      <div class="warning">{{ t('settings.plugins.memory.hasFacts') }}</div>
    </div>
    <div class="form-field horizontal">
      <label>{{ t('settings.plugins.memory.contents') }}</label>
      <button @click.prevent="onView">{{ t('settings.plugins.memory.view') }}</button>
      <button @click.prevent="onReset">{{ t('common.clear') }}</button>
    </div>
    <MemoryInspector ref="inspector" @close="load"/>
  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import EmbeddingSelector from '../components/EmbeddingSelector.vue'
import MemoryInspector from '../screens/MemoryInspector.vue'

const enabled = ref(false)
const hasFacts = ref(false)
const engine = ref('openai')
const model = ref('')
const inspector = ref(null)

const ready = computed(() => {
  return store.config.plugins.memory.engine && store.config.plugins.memory.model
})

const load = () => {
  hasFacts.value = window.api.memory.isNotEmpty()
  engine.value = store.config.plugins.memory.engine || 'openai'
  model.value = store.config.plugins.memory.model || ''
  enabled.value = store.config.plugins.memory.enabled || false
  if (!ready.value) enabled.value = false
}

const save = () => {
  store.config.plugins.memory.enabled = enabled.value
  store.config.plugins.memory.engine = engine.value
  store.config.plugins.memory.model = model.value
  store.saveSettings()
}

const onView = () => {
  inspector.value.show()
}

const onReset = () => {
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: t('settings.plugins.memory.resetConfirmation.title'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.continue'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.memory.reset()
      hasFacts.value = false
    }
  })
}

defineExpose({ load })

</script>


<style scoped>

:deep() .form-field label {
  min-width: 150px !important;
}

:deep() .form-field:has([required]) label:not(:empty)::after {
  content: ':' !important;
}

.warning {
  font-style: italic;
  margin-bottom: 8px;
}

</style>
