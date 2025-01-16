<template>
  <AlertDialog id="engine-model-picker" ref="dialog" @keyup.enter="onSave">
    <template v-slot:body>
      <div class="group">
        <label>LLM Provider</label>
        <EngineSelect v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="group">
        <label>LLM Model</label>
        <ModelSelect v-model="model" :engine="engine" />
      </div>
    </template> 
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>Cancel</button>
        <button @click="onSave" class="alert-confirm">Save</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory from '../llms/llm'

const dialog = ref(null)
const engine = ref('openai')
const model = ref('gpt-4o')

const emit = defineEmits(['save'])

const props = defineProps({
  engine: {
    type: String,
    default: 'openai',
  },
  model: {
    type: String,
    default: 'gpt-4o',
  },
})

onMounted(() => {
  watch(() => props.engine, () => {
    engine.value = props.engine
    model.value = props.model
  })
})

const close = () => {
  dialog.value.close('#engine-model-picker')
}

const onChangeEngine = () => {
  const llmFactory = new LlmFactory(store.config)
  model.value = llmFactory.getChatModel(engine.value, false)
}

const onCancel = () => {
  close()
}

const onSave = () => {
  emit('save', { engine: engine.value, model: model.value })
  close()
}

defineExpose({
  show: () => dialog.value.show('#engine-model-picker'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
