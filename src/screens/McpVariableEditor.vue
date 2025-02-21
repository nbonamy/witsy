<template>
  <AlertDialog id="mcp-variable-editor" ref="dialog" @keydown.enter.prevent @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">MCP Environment Variable</div>
    </template>
    <template v-slot:body>
      <div class="group">
        <label>Key</label>
        <input type="text" name="key" v-model="key" autofocus spellcheck="false" autocapitalize="false"
          autocomplete="false" autocorrect="false" />
      </div>
      <div class="group">
        <label>Value</label>
        <input type="text" name="value" v-model="value" autofocus spellcheck="false" autocapitalize="false"
          autocomplete="false" autocorrect="false" />
      </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>Cancel</button>
        <button name="save" @click="onSave" class="alert-confirm">Save</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch, PropType } from 'vue'
import { type McpServer } from '../types/mcp'
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
      title: 'Some fields are required',
      text: 'Make sure you enter a key for this variable.',
      confirmButtonText: 'OK',
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
