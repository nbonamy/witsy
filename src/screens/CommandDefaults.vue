<template>
  <ModalDialog id="command-defaults" ref="dialog" @save="onSave">
    <template #header>
      <div class="title">{{ t('commands.defaults.title') }}</div>
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('commands.defaults.lastOneUsed')" />
      </div>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect id="model" v-model="model" :engine="engine" :default-text="!models.length ? t('commands.defaults.lastOneUsed') : ''" />
      </div>
      <div class="form-field" v-if="isWindows">
        <label>{{ t('commands.defaults.altWinCopyPaste') }}</label>
        <input type="checkbox" v-model="altWinCopyPaste" />
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="default">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
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
  dialog.value.close()
}

defineExpose({
  show: () => {
    load()
    dialog.value.show()
  },
  close,
})


</script>


<style scoped>

dialog.editor .form .form-field label {
  min-width: 200px;
  max-width: 200px;
}

</style>
