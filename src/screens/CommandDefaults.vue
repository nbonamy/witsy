<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Commands defaults</div>
      </header>
      <main>
        <div class="group">
          <label>LLM Provider</label>
          <EngineSelect v-model="engine" @change="onChangeEngine" default-text="Last one used" />
        </div>
        <div class="group">
          <label>LLM Model</label>
          <ModelSelect v-model="model" :engine="engine" :default-text="!models.length ? 'Last one used' : ''" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'

const engine = ref(null)
const model = ref(null)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  engine.value = store.config.commands?.engine || ''
  model.value = store.config.commands?.model || ''
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

const onCancel = () => {
  load()
}

const onSave = () => {
  store.config.commands.engine = engine.value
  store.config.commands.model = model.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>
