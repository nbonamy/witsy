<template>
  <ModalDialog id="engine-model-picker" ref="dialog" @save="onSave">
    <template #body>
      <div class="form-field">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect :favorites="favorites" v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="model" :engine="engine" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.streaming') }}</label>
        <select name="streaming" v-model="disableStreaming">
          <option :value="false">{{ t('common.enabled') }}</option>
          <option :value="true">{{ t('common.disabled') }}</option>
        </select>
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.plugins') }}</label>
        <select name="plugins" v-model="disableTools">
          <option :value="false">{{ t('common.enabled') }}</option>
          <option :value="true">{{ t('common.disabled') }}</option>
        </select>
      </div>
    </template> 
    <template #footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="alert-confirm">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory, { favoriteMockEngine } from '../llms/llm'

const llmManager = LlmFactory.manager(store.config)

const dialog = ref(null)
const engine = ref('openai')
const model = ref('gpt-4o')
const disableStreaming = ref(false)
const disableTools = ref(false)

const emit = defineEmits(['save'])

const props = defineProps({
  favorites: {
    type: Boolean,
    default: true,
  },
  engine: {
    type: String,
    default: 'openai',
  },
  model: {
    type: String,
    default: 'gpt-4o',
  },
  disableStreaming: {
    type: Boolean,
    default: false,
  },
  disableTools: {
    type: Boolean,
    default: false,
  },
})

const onShow = () => {

  // get value
  engine.value = props.engine
  model.value = props.model
  disableStreaming.value = props.disableStreaming
  disableTools.value = props.disableTools

  // use favorites
  if (props.favorites && llmManager.isFavoriteModel(engine.value, model.value)) {
    const favId = llmManager.getFavoriteId(engine.value, model.value)
    if (favId) {
      engine.value = favoriteMockEngine
      model.value = favId
    }
  }

}

const close = () => {
  dialog.value.close()
}

const onChangeEngine = () => {
  model.value = llmManager.getDefaultChatModel(engine.value, false)
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (llmManager.isFavoriteEngine(engine.value)) {
    const favorite = llmManager.getFavoriteModel(model.value)
    emit('save', { engine: favorite.engine, model: favorite.model, disableTools: disableTools.value, disableStreaming: disableStreaming.value })
  } else {
    emit('save', { engine: engine.value, model: model.value, disableTools: disableTools.value, disableStreaming: disableStreaming.value })
  }
  close()
}

defineExpose({
  show: () => {
    onShow()
    dialog.value.show()
  },
  close,
})

</script>

