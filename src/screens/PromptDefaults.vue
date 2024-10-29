<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Prompt defaults</div>
      </header>
      <main>
        <div class="group">
          <label>LLM Provider</label>
          <EngineSelect v-model="engine" @change="onChangeEngine" default-text="Use global default" />
        </div>
        <div class="group">
          <label>LLM Model</label>
          <ModelSelect v-model="model" :engine="engine" :default-text="!models.length ? 'Use global default' : ''" />
        </div>
        <div class="group autosave checkbox">
          <label>Always save prompt sessions in chat history</label>
          <input type="checkbox" v-model="autosave" />
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

import { ref, computed, onMounted } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'

const emit = defineEmits(['defaults-modified']);

const engine = ref(null)
const model = ref(null)
const autosave = ref(false)

onMounted(() => {
  load()
})

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  engine.value = store.config.prompt.engine || ''
  model.value = store.config.prompt.model || ''
  autosave.value = store.config.prompt.autosave || false
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

const onCancel = () => {
  load()
}

const onSave = () => {
  store.config.prompt.engine = engine.value
  store.config.prompt.model = model.value
  store.config.prompt.autosave = autosave.value
  store.saveSettings()
  emit('defaults-modified')
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>

<style scoped>

dialog::backdrop {
  display: none;
}

.checkbox label {
  width: 300px;
}

</style>