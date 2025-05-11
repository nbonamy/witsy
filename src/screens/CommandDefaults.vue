<template>
  <AlertDialog id="command-defaults" ref="dialog">
    <template v-slot:header>
      <div class="title">{{ t('commands.defaults.title') }}</div>
    </template>
    <template v-slot:body>
      <div class="group">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('commands.defaults.lastOneUsed')" />
      </div>
      <div class="group">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="model" :engine="engine" :default-text="!models.length ? t('commands.defaults.lastOneUsed') : ''" />
      </div>
      <div class="group" v-if="isWindows">
        <label>{{ t('commands.defaults.altWinCopyPaste') }}</label>
        <input type="checkbox" v-model="altWinCopyPaste" />
      </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onSave" class="default">{{ t('common.save') }}</button>
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import AlertDialog from '../components/AlertDialog.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'

const dialog = ref(null)
const engine = ref(null)
const model = ref(null)
const altWinCopyPaste = ref(false)

const isWindows = computed(() => window.api.platform == 'win32')

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  engine.value = store.config.commands?.engine || ''
  model.value = store.config.commands?.model || ''
  altWinCopyPaste.value = store.config.automation?.altWinCopyPaste || false
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

const onCancel = () => {
  close()
}

const onSave = () => {
  store.config.commands.engine = engine.value
  store.config.commands.model = model.value
  store.config.automation.altWinCopyPaste = altWinCopyPaste.value
  store.saveSettings()
  close()
}

const close = () => {
  dialog.value.close('#command-defaults')
}

defineExpose({
  show: () => {
    load()
    dialog.value.show('#command-defaults')
  },
  close,
})


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
