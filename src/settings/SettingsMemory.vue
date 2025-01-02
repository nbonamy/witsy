
<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to store and retrieve information about you, making their answers more personalized.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <EmbeddingSelector :disabled="!enabled || hasFacts" v-model:engine="engine" v-model:model="model" @update="save"/>
    <div class="group">
      <label>Contents</label>
      <button @click.prevent="onView">View</button>
      <button @click.prevent="onReset">Reset</button>
    </div>
    <MemoryInspector ref="inspector" @close="load"/>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import EmbeddingSelector from '../components/EmbeddingSelector.vue'
import MemoryInspector from '../screens/MemoryInspector.vue'

const enabled = ref(false)
const hasFacts = ref(false)
const engine = ref('openai')
const model = ref('text-embedding-ada-002')
const inspector = ref(null)

const load = () => {
  hasFacts.value = window.api.memory.isNotEmpty()
  enabled.value = store.config.plugins.memory.enabled || false
  engine.value = store.config.plugins.memory.engine || 'openai'
  model.value = store.config.plugins.memory.model || 'text-embedding-ada-002'
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
    title: 'Are you sure you want to reset the memory and lose all facts about you?',
    text: 'You can\'t undo this action.',
    confirmButtonText: 'Reset',
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
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

<style scoped>

:deep() .group label {
  min-width: 150px !important;
}

:deep() .group:has([required]) label:not(:empty)::after {
  content: ':' !important;
}

</style>
