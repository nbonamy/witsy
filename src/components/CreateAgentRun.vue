<template>
  <ModalDialog id="create-agent-run" ref="dialog" @save="onSave" width="24rem">
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
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ confirmText }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import { extractAllWorkflowInputs, PromptInput } from '../services/prompt'
import { Agent } from '../types/agents'

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
const inputs = ref<PromptInput[]>([])
const values = ref<Record<string, string>>({})
const callback = ref<((values: Record<string, string>) => void) | null>(null)

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
  // Validate that all required values are present
  const hasEmptyRequired = inputs.value.some(input =>
    !values.value[input.name]?.trim() && !input.defaultValue
  )
  if (hasEmptyRequired) return

  callback.value(values.value)
  close()
}

defineExpose({
  show: (agent: Agent, opts: Record<string, string>, cb: (values: Record<string, string>) => void) => {

    callback.value = cb
    values.value = { ...opts }

    // Extract all inputs from all workflow steps
    const allInputs = extractAllWorkflowInputs(agent.steps)

    // Find missing inputs
    inputs.value = allInputs.filter(input => typeof opts[input.name] === 'undefined')

    // Set default values for missing inputs
    for (const input of inputs.value) {
      if (!values.value[input.name]) {
        values.value[input.name] = input.defaultValue || ''
      }
    }

    // If no inputs are missing, auto-submit
    if (inputs.value.length === 0) {
      onSave()
      return
    }

    dialog.value.show()

  },
  close,
})

</script>


<style>

#create-agent-run .swal2-popup {
  textarea {
    min-height: 8lh;
    resize: vertical;
  }
}

</style>