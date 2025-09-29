<template>
  <ModalDialog id="workspace-editor" ref="dialog" @save="onSave">
    <template #header>
      {{ editing ? t('workspace.editor.edit') : t('workspace.editor.create') }}
    </template>
    <template #body>
      <div style="margin-bottom: 1.5rem">
        {{ editing ? t('workspace.editor.editDescription') : t('workspace.editor.createDescription') }}
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.name') }}</label>
        <input name="name" v-model="name" :placeholder="t('workspace.editor.namePlaceholder')" />
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.icon') }}</label>
        <IconPicker ref="iconPicker" v-model="icon" :maxRows="4" />
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.color') }}</label>
        <ColorPicker v-model="color" />
      </div>
    
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="primary">{{ editing ? t('common.save') : t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { Workspace } from '../types/workspace'
import { ref } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import ColorPicker from './ColorPicker.vue'
import IconPicker from './IconPicker.vue'

const dialog = ref(null)
const iconPicker = ref(null)
const editing = ref(false)
const uuid = ref('')
const name = ref('')
const icon = ref('')
const color = ref('')

const show = (workspace?: Workspace) => {
  if (workspace) {
    editing.value = true
    uuid.value = workspace.uuid
    name.value = workspace.name
    icon.value = workspace.icon || ''
    color.value = workspace.color || '#006edb'
  } else {
    editing.value = false
    uuid.value = crypto.randomUUID()
    name.value = ''
    icon.value = ''
    color.value = '#006edb'
  }
  iconPicker.value?.resetFilter()
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (!name.value.trim()) {
    return
  }

  const workspace: Workspace = {
    uuid: uuid.value,
    name: name.value.trim(),
    icon: icon.value.trim() || undefined,
    color: color.value,
  }

  window.api.workspace.save(workspace)

  dialog.value?.close()

}

defineExpose({ show, close })
</script>

<style>

#workspace-editor .swal2-popup {
  
  width: 32rem !important;
  max-width: 32rem !important;

  .color-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-picker input[type="color"] {
    width: 3rem;
    height: 2rem;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .color-preview {
    width: 2rem;
    height: 2rem;
    border-radius: 0.25rem;
    border: 1px solid var(--control-border-color);
  }

}

</style>