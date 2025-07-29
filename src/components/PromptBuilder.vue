<template>
  <ModalDialog id="prompt-builder" ref="dialog" @save="onSave">
    <template #header>
      {{ title }}
    </template> 
    <template #body>
      <div v-for="field in fields" :key="field.name" class="form-field">
        <label>{{ field.description ?? field.name }}</label>
        <textarea :name="field.name" v-model="values[field.name]" v-if="field.control === 'textarea'"></textarea>
        <input :name="field.name" v-model="values[field.name]" v-else />
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ confirmText }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import { getMissingInputs, PromptInput, replacePromptInputs } from '../services/prompt'

defineProps({
  title: {
    type: String,
    required: true,
  },
  confirmText: {
    type: String,
    default: t('common.ok'),
  },
})

const dialog = ref(null)
const prompt = ref('')
const inputs = ref<PromptInput[]>([])
const values = ref<Record<string, string>>({})
const callback = ref<((prompt: string) => void) | null>(null)

const fields = computed(() => [
  ...inputs.value.map(input => ({
    ...input,
    value: values.value[input.name] || '',
  }))
])

const close = () => {
  dialog.value?.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  const result = replacePromptInputs(prompt.value, values.value)
  callback.value(result)
  close()
}

defineExpose({
  show: (template: string, opts: Record<string, string>, cb: (prompt: string) => void) => {


    if (!template) {

      callback.value = cb
      inputs.value = [
        { name: 'prompt', description: t('common.prompt'), control: 'textarea' },
      ]

    } else {

      values.value = opts
      prompt.value = template
      callback.value = cb

      inputs.value = getMissingInputs(prompt.value, opts)
      for (const input of inputs.value) {
        if (!values.value[input.name]) {
          values.value[input.name] = ''
        }
      }

      if (inputs.value.length === 0) {
        onSave()
        return
      }

    }

    dialog.value.show()

  },
  close,
})

</script>


<style>

#prompt-builder .swal2-popup {
  max-width: 24rem !important;
}

textarea {
  min-height: 8lh;
  resize: vertical;
}

</style>