<template>
  <ModalDialog id="fork-chat" ref="dialog" @save="onSave">
    <template #header>
      <div class="title">{{ t(dialogTitle || 'common.chat') }}</div>
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('chat.editor.title') }}</label>
        <input type="text" v-model="title" />
      </div>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <EngineModelSelect
          :engine="engine"
          :model="model"
          @modelSelected="onModelSelected"
        />
      </div>
    </template> 
    <template #footer>
      <div class="buttons">
        <button @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="primary">{{ t(confirmButtonText || 'common.save' ) }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch, PropType } from 'vue'
import { t } from '@services/i18n'
import Dialog from '@renderer/utils/dialog'
import ModalDialog from '@components/ModalDialog.vue'
import EngineModelSelect from '@components/EngineModelSelect.vue'
import Chat from '@models/chat'

export type ChatEditorCallback = ({title, engine, model}: {title: string, engine: string, model: string}) => void

const dialog = ref(null)
const title = ref('')
const engine = ref('')
const model = ref('')

const props = defineProps({
  chat: {
    type: Chat,
  },
  dialogTitle: {
    type: String,
    required: true,
  },
  confirmButtonText: {
    type: String,
    default: 'common.save',
  },
  onConfirm: {
    type: Function as PropType<ChatEditorCallback>,
    required: true,
  },
})

onMounted(async () => {
  watch(() => props.chat || {}, () => {
    title.value = props.chat?.title
    engine.value = props.chat?.engine
    model.value = props.chat?.model
  }, { deep: true, immediate: true })
})

const close = () => {
  dialog.value.close()
}

const onModelSelected = (selectedEngine: string | null, selectedModel: string | null) => {
  if (selectedEngine) engine.value = selectedEngine
  if (selectedModel) model.value = selectedModel
}

const onCancel = () => {
  close()
}

const onSave = () => {

  if (!title.value.length || !engine.value.length || !model.value.length) {
    Dialog.show({
      title: t('chat.editor.validation.requiredFields'),
      text: t('chat.editor.validation.titleRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  // callback
  props.onConfirm({
    title: title.value,
    engine: engine.value,
    model: model.value,
  })
  close()
}

defineExpose({
  show: () => dialog.value.show(),
  close,
})

</script>
