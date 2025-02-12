<template>
  <AlertDialog id="create-engine" ref="dialog" @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">Create Custom Engine</div>
      <div class="text">Create a new custom engine based on an API standard.</div>
    </template> 
    <template v-slot:body>
      <div class="group">
      <label>Name</label>
      <input v-model="label" placeholder="e.g. Together.ai"/>
    </div>
    <div class="group">
      <label>API Specification</label>
      <select v-model="api">
        <option value="openai">OpenAI</option>
      </select>
    </div>
    <div class="group">
      <label>API Base URL</label>
      <input v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" />
    </div>
    <div class="group">
      <label>API key</label>
      <InputObfuscated v-model="apiKey" />
    </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>Cancel</button>
        <button @click="onSave" class="alert-confirm">Create</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import Dialog from '../composables/dialog'
import InputObfuscated from '../components/InputObfuscated.vue'
import AlertDialog from '../components/AlertDialog.vue'
import defaults from '../../defaults/settings.json'

const dialog = ref(null)
const label = ref(null)
const api = ref(null)
const baseURL = ref(null)
const apiKey = ref(null)

const emit = defineEmits(['create'])

onMounted(async () => {
})

const close = () => {
  dialog.value.close('#create-engine')
}

const onCancel = () => {
  close()
}

const onSave = () => {

  if (!label.value.length || !baseURL.value.length) {
    Dialog.show({
      title: 'Name and Base URL are required',
      text: 'Make sure you enter a value for the required fields.',
      confirmButtonText: 'OK',
    })
    return
  }

  // callback
  emit('create', {
    label: label.value,
    api: api.value,
    baseURL: baseURL.value,
    apiKey: apiKey.value,
  })
  close()
}

defineExpose({
  show: () => {
    label.value = ''
    api.value = 'openai'
    apiKey.value = ''
    baseURL.value = ''
    dialog.value.show('#create-engine')
  },
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

dialog.alert-dialog {
  width: 300px !important;
}

</style>
