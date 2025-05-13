<template>
  <ModalDialog id="variable-editor" :icon="false" ref="dialog" @save="onSave">
    <template #header>
      <div class="title">{{ t(title) }}</div>
    </template>
    <template #body>
      <div class="group">
        <label>{{ t('common.key') }}</label>
        <input type="text" name="key" v-model="key" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
      <div class="group">
        <label>{{ t('common.value') }}</label>
        <input type="text" name="value" v-model="value" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, watch, PropType } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import ModalDialog from '../components/ModalDialog.vue'

const dialog = ref(null)
const key = ref('')
const value = ref('')

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  variable: {
    type: Object as PropType<{ key: string, value: string }>,
    default: () => ({ key: '', value: '' }),
  },
})

const emit = defineEmits(['save'])

onMounted(async () => {
  watch(() => props.variable, () => {
    key.value = props.variable?.key || ''
    value.value = props.variable?.value || ''
    if (key.value.length) {
      const input =  document.querySelector<HTMLInputElement>('#variable-editor [name=value]')
      input?.focus()
      input?.select()
    } else {
      document.querySelector<HTMLElement>('#variable-editor [name=key]')?.focus()
    }
  }, { immediate: true })
})

const close = () => {
  dialog.value?.close('#variable-editor')
}

const onCancel = () => {
  close()
}

const onSave = () => {

  if (!key.value.length) {
    Dialog.show({
      title: t('common.variableEditor.validation.requiredFields'),
      text: t('common.variableEditor.validation.keyRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  close()

  emit('save', {
    key: key.value,
    value: value.value,
  })

}

defineExpose({
  show: () => dialog.value.show('#variable-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
