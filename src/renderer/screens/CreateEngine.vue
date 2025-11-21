<template>
  <ModalDialog id="create-engine" ref="dialog" @save="onSave" width="28rem">
    <template #header>
      {{ t('engine.create.title') }}
    </template> 
    <template #body>
      <div style="margin-bottom: 1.5rem">{{ t('engine.create.description') }}</div>
      <div class="form-field">
        <label>{{ t('engine.create.apiSpecification') }}</label>
        <select name="api" v-model="api">
          <option value="openai">OpenAI</option>
          <option value="azure">Azure OpenAI</option>
        </select>
      </div>
      <div class="form-field">
        <label>{{ t('common.name') }}</label>
        <input name="label" v-model="label" placeholder="e.g. Together.ai"/>
      </div>
      <template v-if="api === 'openai'">
        <div class="form-field">
          <label>{{ t('engine.create.apiBaseURL') }}</label>
          <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" />
        </div>
        <div class="form-field">
          <label>{{ t('engine.create.apiKey') }}</label>
          <InputObfuscated name="apiKey" v-model="apiKey" />
        </div>
      </template>
      <template v-if="api === 'azure'">
        <div class="form-field">
          <label>{{ t('engine.create.endpoint') }}</label>
          <input name="baseURL" v-model="baseURL" placeholder="https://xxx.openai.azure.com/" />
        </div>
        <div class="form-field">
          <label>{{ t('engine.create.apiKey') }}</label>
          <InputObfuscated name="apiKey" v-model="apiKey" />
        </div>
        <div class="form-field">
          <label>{{ t('engine.create.deployment') }}</label>
          <input name="deployment" v-model="deployment" />
        </div>
        <div class="form-field">
          <label>{{ t('engine.create.apiVersion') }}</label>
          <input name="apiVersion" v-model="apiVersion" />
        </div>
      </template>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import { t } from '@services/i18n'
import Dialog from '@renderer/utils/dialog'
import InputObfuscated from '../components/InputObfuscated.vue'
import ModalDialog from '../components/ModalDialog.vue'
import defaults from '@root/defaults/settings.json'

const dialog = ref(null)
const label = ref(null)
const api = ref(null)
const baseURL = ref(null)
const apiKey = ref(null)
const deployment = ref(null)
const apiVersion = ref(null)

const emit = defineEmits(['create'])

onMounted(async () => {
})

const close = () => {
  dialog.value.close()
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
    deployment: deployment.value,
    apiVersion: apiVersion.value,
  })
  close()
}

defineExpose({
  show: (apiSpec: string = 'openai') => {
    label.value = ''
    api.value = apiSpec
    apiKey.value = ''
    baseURL.value = ''
    deployment.value = ''
    apiVersion.value = ''
    dialog.value.show()
  },
  close,
})

</script>
