<template>
  <ModalDialog id="docrepocreate" ref="dialog">
    <template #header>
      <div class="title">{{ t('docRepo.create.title') }}</div>
      <div class="text"><b>{{ t('common.warning') }}</b>: {{ t('docRepo.create.embeddingWarning') }}</div>
    </template>
    <template #body>
      <div class="group name">
        <label>{{ t('common.name') }}</label>
        <input type="text" ref="nameInput" v-model="name" required />
      </div>
      <EmbeddingSelector v-model:engine="engine" v-model:model="model" />
    </template>
    <template #footer>
      <div class="buttons">
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
        <button @click="onCreate" class="default">{{ t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, nextTick } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import EmbeddingSelector from '../components/EmbeddingSelector.vue'
import Dialog from '../composables/dialog'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const dialog = ref(null)
const nameInput = ref(null)
const name = ref('')
const engine = ref('openai')
const model = ref('')

onMounted(() => {
  onEvent('open-docrepo-create', onOpen)
})

const onOpen = () => {
  dialog.value.show()
  name.value = t('docRepo.create.defaultName')
  nextTick(() => {
    nameInput.value.focus()
    nameInput.value.select()
  })
}

const onCreate = (event: Event) => {

  // check
  if (!name.value || !engine.value || !model.value) {
    event.preventDefault()
    Dialog.alert(t('commands.editor.validation.requiredFields'))
    return
  } 

  // create
  window.api.docrepo.create(name.value, engine.value, model.value)
}

const onCancel = () => {
  dialog.value.close()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style>
#docrepocreate form .group label {
  min-width: 150px;
}
</style>
