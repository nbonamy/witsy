<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">{{ t('commands.defaults.title') }}</div>
      </header>
      <main>
        <div class="group">
          <label>{{ t('common.llmProvider') }}</label>
          <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('commands.defaults.lastOneUsed')" />
        </div>
        <div class="group">
          <label>{{ t('common.llmModel') }}</label>
          <ModelSelect v-model="model" :engine="engine" :default-text="!models.length ? t('commands.defaults.lastOneUsed') : ''" />
        </div>
        <div class="group" v-if="isWindows">
          <label>{{ t('commands.defaults.altWindowsCopy') }}</label>
          <input type="checkbox" v-model="altWindowsCopy" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">{{ t('common.save') }}</button>
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'

const engine = ref(null)
const model = ref(null)
const altWindowsCopy = ref(false)

const isWindows = computed(() => window.api.platform == 'win32')

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  engine.value = store.config.commands?.engine || ''
  model.value = store.config.commands?.model || ''
  altWindowsCopy.value = store.config.automation?.altWindowsCopy || false
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
  store.config.automation.altWindowsCopy = altWindowsCopy.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>

<style scoped>

dialog.editor form .group label {
  min-width: 200px;
  max-width: 200px;
}

</style>
