<template>
  <AlertDialog id="chat-editor" ref="dialog" @keyup.enter="onSave">
    <template v-slot:body>
      <div class="group">
        <label>{{ t('chat.editor.title') }}</label>
        <input type="text" v-model="title" />
      </div>
      <div class="group">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="group">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="model" :engine="engine" />
      </div>
    </template> 
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="alert-confirm">{{ t(confirmButtonText) }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

import { ref, onMounted, watch, PropType } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory from '../llms/llm'
import Chat from '../models/chat'

export type ChatEditorCallback = ({title, engine, model}: {title: string, engine: string, model: string}) => void

const dialog = ref(null)
const title = ref('')
const engine = ref('')
const model = ref('')

const props = defineProps({
  chat: {
    type: Chat,
  },
  onConfirm: {
    type: Function as PropType<ChatEditorCallback>,
    required: true,
  },
  confirmButtonText: {
    type: String,
    default: 'common.save',
  },
})

onMounted(async () => {
  watch(() => props.chat || {}, () => {
    title.value = props.chat?.title
    engine.value = props.chat?.engine
    model.value = props.chat?.model
  }, { immediate: true })
})

const close = () => {
  dialog.value.close('#chat-editor')
}

const onChangeEngine = () => {
  const llmFactory = new LlmFactory(store.config)
  model.value = llmFactory.getChatModel(engine.value, false)
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
  show: () => dialog.value.show('#chat-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>