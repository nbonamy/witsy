<template>
  <div class="instruction-editor form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.llm.instructions.editor.label') }}</label>
      <input type="text" v-model="localInstruction.label" :disabled="isDefaultInstruction" />
    </div>
    <div class="form-field">
      <label>{{ t('settings.llm.instructions.editor.instructions') }}</label>
      <textarea v-model="localInstruction.instructions"></textarea>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel">{{ t('common.cancel') }}</button>
      <button type="button" @click="onReset" v-if="isDefaultInstruction">{{ t('common.reset') }}</button>
      <button type="button" @click="onSave" class="default" :disabled="!isValid">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { CustomInstruction } from 'types'
import { ref, computed, watch } from 'vue'
import { i18nInstructions, t } from '../services/i18n'

interface Props {
  instruction: CustomInstruction | null
}

interface Emits {
  (e: 'cancel'): void
  (e: 'save', instruction: CustomInstruction): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localInstruction = ref<CustomInstruction>({
  id: '',
  label: '',
  instructions: ''
})

const isDefaultInstruction = computed(() => {
  return localInstruction.value.id.startsWith('default_')
})

const isValid = computed(() => {
  const hasInstructions = localInstruction.value.instructions.trim().length > 0
  if (isDefaultInstruction.value) {
    // For default instructions, only require instructions content
    return hasInstructions
  } else {
    // For custom instructions, require both label and instructions
    return localInstruction.value.label.trim().length > 0 && hasInstructions
  }
})

watch(() => props.instruction, (newInstruction) => {
  if (newInstruction) {
    localInstruction.value = { ...newInstruction }
  } else {
    localInstruction.value = {
      id: '',
      label: '',
      instructions: ''
    }
  }
}, { immediate: true })

const onReset = () => {
  localInstruction.value.instructions = i18nInstructions(null, `instructions.chat.${localInstruction.value.id.replace('default_', '')}`)
}

const onCancel = () => {
  emit('cancel')
}

const onSave = () => {
  if (!isValid.value) return
  
  emit('save', {
    id: localInstruction.value.id || crypto.randomUUID(),
    label: localInstruction.value.label.trim(),
    instructions: localInstruction.value.instructions.trim()
  })
}

</script>


<style scoped>

.instruction-editor {
  
  .form-field textarea {
    min-height: 400px !important;
  }

}

</style>