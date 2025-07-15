<template>
  <div class="instruction-editor">
    <div class="group">
      <label>{{ t('settings.llm.instructions.editor.label') }}</label>
      <input type="text" v-model="localInstruction.label" :disabled="isDefaultInstruction" />
    </div>
    <div class="group">
      <label>{{ t('settings.llm.instructions.editor.instructions') }}</label>
      <textarea v-model="localInstruction.instructions" rows="10"></textarea>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel">{{ t('common.cancel') }}</button>
      <button type="button" @click="onSave" class="default" :disabled="!isValid">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { CustomInstruction } from '../types/config'
import { ref, computed, watch } from 'vue'
import { t } from '../services/i18n'

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
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

.instruction-editor {
  
  textarea {
    height: 200px;
    resize: vertical !important;
  }

}

</style>