<template>
  <div class="skill-editor form form-vertical form-large" @keydown.enter="onSave">
    <div class="form-field">
      <label>{{ t('common.name') }}</label>
      <input type="text" name="name" v-model="name" required :readonly="props.readonly" />
    </div>
    <div class="form-field">
      <label>{{ t('common.description') }}</label>
      <textarea name="description" v-model="description" :readonly="props.readonly" />
    </div>
    <div class="form-field">
      <label>{{ t('common.instructions') }}</label>
      <textarea name="instructions" v-model="instructions" required :readonly="props.readonly" />
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ props.readonly ? t('common.close') : t('common.cancel') }}</button>
      <button v-if="!props.readonly" type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { ref, watch } from 'vue'

type SkillDraft = {
  id?: string
  name?: string
  description?: string
  instructions?: string
}

const emit = defineEmits<{
  'skill-modified': [SkillDraft | null]
}>()

const props = defineProps<{
  skill: SkillDraft | null
  readonly?: boolean
}>()

const name = ref('')
const description = ref('')
const instructions = ref('')

watch(() => props.skill, () => {
  name.value = props.skill?.name || ''
  description.value = props.skill?.description || ''
  instructions.value = props.skill?.instructions || ''
}, { immediate: true, deep: true })

const onCancel = () => emit('skill-modified', null)

const onSave = (event: Event) => {
  if (props.readonly) {
    emit('skill-modified', null)
    return
  }
  if ((event.target as HTMLElement).nodeName.toLowerCase() === 'textarea') return
  if (!name.value.trim().length || !instructions.value.trim().length) {
    Dialog.alert(t('experts.editor.validation.requiredFields'))
    return
  }
  emit('skill-modified', {
    id: props.skill?.id,
    name: name.value.trim(),
    description: description.value.trim(),
    instructions: instructions.value,
  })
}

</script>

<style scoped>

.skill-editor textarea[name="description"] {
  flex: auto;
  height: 5lh;
  resize: vertical !important;
}

.skill-editor textarea[name="instructions"] {
  flex: auto;
  height: 20lh;
  resize: vertical !important;
}

</style>
