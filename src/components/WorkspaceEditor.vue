<template>
  <ModalDialog id="workspace-editor" ref="dialog" @save="onSave">
    <template #header>
      {{ isEditing ? t('workspace.editor.edit') : t('workspace.editor.create') }}
    </template> 
    <template #body>
      <div style="margin-bottom: 1.5rem">
        {{ isEditing ? t('workspace.editor.editDescription') : t('workspace.editor.createDescription') }}
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.name') }}</label>
        <input name="name" v-model="workspaceName" :placeholder="t('workspace.editor.namePlaceholder')" />
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.icon') }}</label>
        <input name="icon" v-model="workspaceIcon" :placeholder="t('workspace.editor.iconPlaceholder')" maxlength="2" />
      </div>
      
      <div class="form-field">
        <label>{{ t('workspace.editor.color') }}</label>
        <div class="color-picker">
          <input type="color" name="color" v-model="workspaceColor" />
          <span class="color-preview" :style="{ backgroundColor: workspaceColor }"></span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ isEditing ? t('common.save') : t('common.create') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import { Workspace } from '../types/workspace'

const dialog = ref(null)
const workspaceName = ref('')
const workspaceIcon = ref('')
const workspaceColor = ref('#007bff')
const editingWorkspace = ref<Workspace | null>(null)

const isEditing = computed(() => !!editingWorkspace.value)

const emit = defineEmits(['save'])

const show = (workspace?: Workspace) => {
  if (workspace) {
    editingWorkspace.value = workspace
    workspaceName.value = workspace.name
    workspaceIcon.value = workspace.icon || ''
    workspaceColor.value = workspace.color || '#007bff'
  } else {
    editingWorkspace.value = null
    workspaceName.value = ''
    workspaceIcon.value = ''
    workspaceColor.value = '#007bff'
  }
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  if (!workspaceName.value.trim()) {
    return
  }

  const workspace: Workspace = {
    uuid: editingWorkspace.value?.uuid || crypto.randomUUID(),
    name: workspaceName.value.trim(),
    icon: workspaceIcon.value.trim() || undefined,
    color: workspaceColor.value,
  }

  emit('save', workspace)
}

defineExpose({ show, close })
</script>

<style scoped>
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
</style>