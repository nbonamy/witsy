<template>
  <div class="webapp-editor form form-vertical form-large" @keydown.enter="onSave">
    <div class="form-field">
      <label>{{ t('webapps.name') }}</label>
      <input type="text" name="name" v-model="name" required />
    </div>
    <div class="form-field">
      <label>{{ t('webapps.url') }}</label>
      <input type="url" name="url" v-model="url" required placeholder="https://example.com" />
    </div>
    <div class="form-field">
      <label>{{ t('webapps.icon') }}</label>
      <IconPicker v-model="icon" />
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="webapp-enabled" v-model="enabled" />
      <label for="webapp-enabled">{{ t('webapps.enabled') }}</label>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { onMounted, ref, watch } from 'vue'
import IconPicker from '../components/IconPicker.vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { WebApp } from '../types/workspace'

const emit = defineEmits(['webapp-modified'])

const props = defineProps<{
  webapp: WebApp | null
}>()

const name = ref('')
const url = ref('')
const icon = ref('Globe')
const enabled = ref(true)

onMounted(() => {
  watch(() => props.webapp, () => {
    name.value = props.webapp?.name || ''
    url.value = props.webapp?.url || ''
    icon.value = props.webapp?.icon || 'Globe'
    enabled.value = props.webapp?.enabled ?? true
  }, { deep: true, immediate: true })
})

const close = () => {
  emit('webapp-modified', null)
}

const onCancel = () => {
  close()
}

const onSave = (event: Event) => {
  // Not in input field
  if ((event.target as HTMLElement).nodeName.toLowerCase() === 'input') {
    return
  }

  // Validate
  if (!name.value || !url.value) {
    event.preventDefault()
    Dialog.alert(t('webapps.validation.requiredFields'))
    return
  }

  // Emit the modified webapp
  emit('webapp-modified', {
    id: props.webapp?.id,
    name: name.value,
    url: url.value,
    icon: icon.value,
    enabled: enabled.value
  })
}

</script>

<style scoped>


</style>
