<template>
  <AlertDialog id="engine-model-picker" ref="dialog" @keyup.enter="onSave">
    <template v-slot:body>
      <div class="group">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect :favorites="favorites" v-model="engine" @change="onChangeEngine"/>
      </div>
      <div class="group">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="model" :engine="engine" />
      </div>
    </template> 
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onSave" class="alert-confirm">{{ t('common.save') }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import AlertDialog from '../components/AlertDialog.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LlmFactory, { favoriteMockEngine } from '../llms/llm'

const llmFactory = new LlmFactory(store.config)

const dialog = ref(null)
const engine = ref('openai')
const model = ref('gpt-4o')

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
})

onMounted(() => {
  watch(() => props, () => {

    // get value
    engine.value = props.engine
    model.value = props.model

    // use favorites
    if (props.favorites) {
      const favId = llmFactory.getFavoriteId(engine.value, model.value)
      if (favId) {
        engine.value = favoriteMockEngine
        model.value = favId
      }
    }

  }, { immediate: true })
})

const close = () => {
  dialog.value.close('#engine-model-picker')
}

const onChangeEngine = () => {
  model.value = llmFactory.getChatModel(engine.value, false)
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (llmFactory.isFavoriteEngine(engine.value)) {
    const favorite = llmFactory.getFavoriteModel(model.value)
    emit('save', { engine: favorite.engine, model: favorite.model })
  } else {
    emit('save', { engine: engine.value, model: model.value })
  }
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