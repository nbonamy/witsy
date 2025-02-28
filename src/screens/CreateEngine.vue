<template>
  <AlertDialog id="create-engine" ref="dialog" @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">{{ t('engine.create.title') }}</div>
      <div class="text">{{ t('engine.create.description') }}</div>
    </template> 
    <template v-slot:body>
      <div class="group">
      <label>{{ t('common.name') }}</label>
      <input v-model="label" placeholder="e.g. Together.ai"/>
    </div>
    <div class="group">
      <label>{{ t('engine.create.apiSpecification') }}</label>
      <select v-model="api">
        <option value="openai">OpenAI</option>
      </select>
    </div>
    <div class="group">
      <label>{{ t('engine.create.apiBaseURL') }}</label>
      <input v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" />
    </div>
    <div class="group">
      <label>{{ t('engine.create.apiKey') }}</label>
      <InputObfuscated v-model="apiKey" />
    </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="alert-confirm">{{ t('common.create') }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

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
      title: t('engine.create.validation.nameBaseURLRequired'),
      text: t('common.required.fieldsRequired'),
      confirmButtonText: t('common.ok'),
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