<template>
  <ModalDialog id="link-editor" class="link-editor" ref="dialog" @save="onSave">
    <template #header>
      <div class="title">{{ title }}</div>
    </template>
    <template #body>
      <div class="form-field">
        <label>Text</label>
        <input
          ref="textInput"
          type="text"
          name="text"
          v-model="text"
          placeholder="Link text"
          spellcheck="false"
          autocapitalize="false"
          autocomplete="false"
          autocorrect="false"
        />
      </div>
      <div class="form-field">
        <label>URL</label>
        <input
          type="text"
          name="url"
          v-model="url"
          placeholder="https://example.com"
          spellcheck="false"
          autocapitalize="false"
          autocomplete="false"
          autocorrect="false"
          @keydown.enter="onSave"
        />
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>Cancel</button>
        <button name="remove" @click="onRemove" class="secondary" v-if="initialUrl">Remove Link</button>
        <button name="save" @click="onSave" class="primary">{{ initialUrl ? 'Update' : 'Insert' }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import ModalDialog from '@components/ModalDialog.vue'

const dialog = ref(null)
const textInput = ref<HTMLInputElement | null>(null)
const text = ref('')
const url = ref('')
const initialUrl = ref('')

const emit = defineEmits(['save', 'remove'])

const title = ref('Insert Link')

const show = async (currentText?: string, currentUrl?: string) => {
  text.value = currentText || ''
  url.value = currentUrl || ''
  initialUrl.value = currentUrl || ''
  title.value = currentUrl ? 'Edit Link' : 'Insert Link'

  await nextTick()
  dialog.value?.show()

  nextTick(() => {
    // Focus text field if empty, otherwise URL field
    if (!text.value) {
      textInput.value?.focus()
    } else {
      document.querySelector<HTMLInputElement>('#link-editor [name=url]')?.focus()
      document.querySelector<HTMLInputElement>('#link-editor [name=url]')?.select()
    }
  })
}

const close = () => {
  dialog.value?.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  // Validate URL is provided
  if (!url.value.trim()) {
    return
  }

  close()
  emit('save', { text: text.value, url: url.value })
}

const onRemove = () => {
  close()
  emit('remove')
}

defineExpose({
  show,
  close,
})
</script>

<style scoped>
.link-editor .form-field {
  margin-bottom: var(--space-4);
}

.link-editor input[name="url"] {
  width: 100%;
  min-width: 400px;
}
</style>
