<template>
  <ModalDialog id="scratchpad-settings" ref="dialog" @save="onSave">
    <template #header>
      {{ t('common.settings') }}
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('scratchpad.fontFamily.title') }}</label>
        <select v-model="fontFamily">
          <option value="serif">{{ t('scratchpad.fontFamily.serif') }}</option>
          <option value="sans-serif">{{ t('scratchpad.fontFamily.sansSerif') }}</option>
          <option value="monospace">{{ t('scratchpad.fontFamily.monospace') }}</option>
        </select>
      </div>

      <div class="form-field">
        <label>{{ t('scratchpad.fontSize.title') }}</label>
        <select v-model="fontSize">
          <option value="1">{{ t('scratchpad.fontSize.smaller') }}</option>
          <option value="2">{{ t('scratchpad.fontSize.small') }}</option>
          <option value="3">{{ t('scratchpad.fontSize.normal') }}</option>
          <option value="4">{{ t('scratchpad.fontSize.large') }}</option>
          <option value="5">{{ t('scratchpad.fontSize.larger') }}</option>
        </select>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import ModalDialog from '../components/ModalDialog.vue'

const dialog = ref(null)
const fontFamily = ref(null)
const fontSize = ref(null)

const emit = defineEmits(['save'])

const show = () => {
  load()
  dialog.value?.show()
}

const close = () => {
  dialog.value.close()
}

const load = () => {
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'
}

const onSave = () => {
  emit('save', {
    fontFamily: fontFamily.value,
    fontSize: fontSize.value
  })
  close()
}

const onCancel = () => {
  close()
}

defineExpose({
  show,
  close
})

</script>
