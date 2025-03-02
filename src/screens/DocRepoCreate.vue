<template>
  <dialog class="editor" id="docrepocreate">
    <form method="dialog">
      <header>
        <div class="title">{{ t('docRepo.create.title') }}</div>
      </header>
      <main>
        <div class="group" style="margin-bottom: 16px">
          <label></label>
          <span><b>{{ t('common.warning') }}</b>: {{ t('docRepo.create.embeddingWarning') }}</span>
        </div>
        <div class="group name">
          <label>{{ t('common.name') }}</label>
          <input type="text" ref="nameInput" v-model="name" required />
        </div>
        <EmbeddingSelector v-model:engine="engine" v-model:model="model" />
      </main>
      <footer>
        <button @click="onCreate" class="default">{{ t('common.create') }}</button>
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { ref, onMounted, nextTick } from 'vue'
import { t } from '../services/i18n'
import EmbeddingSelector from '../components/EmbeddingSelector.vue'
import Dialog from '../composables/dialog'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const nameInput = ref(null)
const name = ref('')
const engine = ref('openai')
const model = ref('')

onMounted(() => {
  onEvent('open-docrepo-create', onOpen)
})

const onOpen = () => {
  document.querySelector<HTMLDialogElement>('#docrepocreate').showModal()
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
  document.querySelector<HTMLDialogElement>('#docrepocreate').close()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>

<style scoped>
#docrepocreate .group label {
  min-width: 150px;
}
</style>