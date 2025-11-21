<template>
  <ModalDialog id="agent-model-settings" ref="dialog" @save="onSave">
    <template #header>
      {{ t('agent.create.settings.title') }}
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('modelSettings.contextWindowSize') }}</label>
        <input type="text" name="contextWindowSize" v-model="contextWindowSize" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
        <input type="text" name="maxTokens" v-model="maxTokens" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.temperature') }}</label>
        <input type="text" name="temperature" v-model="temperature" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.topK') }}</label>
        <input type="text" name="top_k" v-model="top_k" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.topP') }}</label>
        <input type="text" name="top_p" v-model="top_p" :placeholder="t('modelSettings.defaultModelValue')" />
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
import ModalDialog from '../components/ModalDialog.vue'
import Agent from '@models/agent'
import { t } from '@services/i18n'

interface Props {
  agent: Agent
}

const props = defineProps<Props>()

const dialog = ref<InstanceType<typeof ModalDialog>>()
const contextWindowSize = ref(undefined)
const maxTokens = ref(undefined)
const temperature = ref(undefined)
const top_k = ref(undefined)
const top_p = ref(undefined)

const show = () => {
  load()
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

const load = () => {
  contextWindowSize.value = props.agent.modelOpts.contextWindowSize || ''
  maxTokens.value = props.agent.modelOpts.maxTokens || ''
  temperature.value = props.agent.modelOpts.temperature || ''
  top_k.value = props.agent.modelOpts.top_k || ''
  top_p.value = props.agent.modelOpts.top_p || ''
}

const onCancel = () => {
  close()
}

const onSave = () => {
  props.agent.modelOpts.contextWindowSize = contextWindowSize.value
  props.agent.modelOpts.maxTokens = maxTokens.value
  props.agent.modelOpts.temperature = temperature.value
  props.agent.modelOpts.top_k = top_k.value
  props.agent.modelOpts.top_p = top_p.value
  close()
}

defineExpose({ show, close })

</script>
