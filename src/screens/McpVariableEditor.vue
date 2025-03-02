<template>
  <AlertDialog id="mcp-variable-editor" ref="dialog" @keydown.enter.prevent @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">{{ t('mcp.variableEditor.title') }}</div>
    </template>
    <template v-slot:body>
      <div class="group">
        <label>{{ t('common.key') }}</label>
        <input type="text" name="key" v-model="key" autofocus spellcheck="false" autocapitalize="false"
          autocomplete="false" autocorrect="false" />
      </div>
      <div class="group">
        <label>{{ t('common.value') }}</label>
        <input type="text" name="value" v-model="value" autofocus spellcheck="false" autocapitalize="false"
          autocomplete="false" autocorrect="false" />
      </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ t('common.save') }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch, PropType } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'

const dialog = ref(null)
const key = ref('')
const value = ref('')

const props = defineProps({
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
  }, { immediate: true })
})

const close = () => {
  dialog.value.close('#mcp-variable-editor')
}

const onCancel = () => {
  close()
}

const onSave = () => {

  if (!key.value.length) {
    Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.variableEditor.validation.keyRequired'),
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
  show: () => dialog.value.show('#mcp-variable-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>