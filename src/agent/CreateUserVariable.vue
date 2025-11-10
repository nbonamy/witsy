<template>
  <ModalDialog id="create-user-variable" ref="dialog" @save="onSave" width="28rem">
    <template #header>
      {{ t('agent.create.workflow.createUserVariable') }}
    </template>
    <template #body>
      <div class="form-field">
        <label>{{ t('agent.create.workflow.createVariable.name') }}</label>
        <div class="help">{{ t('agent.create.workflow.createVariable.nameHelper') }}</div>
        <input
          name="variableName"
          v-model="variableName"
          @input="sanitizeVariableName"
          :placeholder="t('agent.create.workflow.createVariable.namePlaceholder')"
        />
      </div>
      <div class="form-field">
        <label>{{ t('agent.create.workflow.createVariable.description') }} (optional)</label>
        <div class="help">{{ t('agent.create.workflow.createVariable.descriptionHelper') }}</div>
        <input
          name="description"
          v-model="description"
          :placeholder="t('agent.create.workflow.createVariable.descPlaceholder')"
        />
      </div>
      <div class="form-field">
        <label>{{ t('agent.create.workflow.createVariable.defaultValue') }} (optional)</label>
        <div class="help">{{ t('agent.create.workflow.createVariable.defaultValueHelper') }}</div>
        <input
          name="defaultValue"
          v-model="defaultValue"
          :placeholder="t('agent.create.workflow.createVariable.defaultPlaceholder')"
        />
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import ModalDialog from '../components/ModalDialog.vue'
import { kAgentStepVarFacts, kAgentStepVarOutputPrefix, kAgentStepVarRunOutput } from '../types/agents'

const dialog = ref(null)
const variableName = ref('')
const description = ref('')
const defaultValue = ref('')
const existingVars = ref<string[]>([])

const emit = defineEmits(['create'])

const sanitizeVariableName = (event: Event) => {
  const input = event.target as HTMLInputElement
  const sanitized = input.value.replace(/[^a-zA-Z0-9]/g, '_')
  variableName.value = sanitized
  input.value = sanitized
}

const validate = (): boolean => {
  // Check name is required
  if (!variableName.value || !variableName.value.trim()) {
    Dialog.alert(t('agent.create.workflow.createVariable.error.nameRequired'))
    return false
  }

  const name = variableName.value.trim()

  // Check name is unique
  if (existingVars.value.includes(name)) {
    Dialog.alert(t('agent.create.workflow.createVariable.error.nameDuplicate', { name }))
    return false
  }

  // Check name is not a system variable
  if (name === kAgentStepVarRunOutput ||
      name === kAgentStepVarFacts ||
      name.startsWith(kAgentStepVarOutputPrefix)) {
    Dialog.alert(t('agent.create.workflow.createVariable.error.nameSystem', { name }))
    return false
  }

  return true
}

const close = () => {
  dialog.value.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (!validate()) {
    return
  }

  emit('create', {
    name: variableName.value.trim(),
    description: description.value.trim(),
    defaultValue: defaultValue.value.trim(),
  })

  close()
}

defineExpose({
  show: (vars: string[] = []) => {
    existingVars.value = vars
    variableName.value = ''
    description.value = ''
    defaultValue.value = ''
    dialog.value.show()
  },
  close,
})

</script>
