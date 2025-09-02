<template>

  <div class="workspace-bar">

    <div class="workspaces">
      <div 
        v-for="workspace in workspaces" 
        :key="workspace.uuid"
        class="workspace-item" 
        :class="{ active: workspace.uuid === activeWorkspaceId }"
        @click="selectWorkspace(workspace.uuid)"
        @contextmenu.prevent="showWorkspaceContextMenu($event, workspace)"
        :title="workspace.name"
      >
        <div 
          class="workspace-icon" 
          :style="{ 
            backgroundColor: workspace.color || '#007bff',
            color: getContrastColor(workspace.color || '#007bff')
          }"
        >
          <component 
            v-if="workspace.icon && workspace.icon.startsWith('BIcon')" 
            :is="workspace.icon" 
          />
          <span v-else>
            {{ workspace.icon || workspace.name.charAt(0).toUpperCase() }}
          </span>
        </div>
      </div>
      
      <div class="workspace-item add-workspace" @click="showWorkspaceEditor" title="Create new workspace">
        <div class="workspace-icon">
          <Grid2X2PlusIcon />
        </div>
      </div>

      <div class="flex-push"></div>

      <div class="workspace-item">
        <div 
          class="workspace-icon" 
          :style="{ 
            backgroundColor: '#1B4FB2',
            color: getContrastColor('#1B4FB2')
          }"
        >
          <StarIcon />
        </div>
      </div>

    </div>

    <WorkspaceEditor ref="workspaceEditor" @save="onWorkspaceSave" />
    <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
  </div>
</template>

<script setup lang="ts">
import { Grid2X2PlusIcon, StarIcon } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { WorkspaceHeader } from '../types/workspace'
import ContextMenu from './ContextMenu.vue'
import WorkspaceEditor from './WorkspaceEditor.vue'

const workspaces = ref<WorkspaceHeader[]>([])
const workspaceEditor = ref(null)
const selectedWorkspace = ref<WorkspaceHeader | null>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const activeWorkspaceId = computed(() => store.config.workspaceId)

const emit = defineEmits(['workspace-changed'])

const workspaceUpdateListener = () => {
  loadWorkspaces()
}

onMounted(async () => {
  loadWorkspaces()
  
  // Listen for workspace updates
  window.api.on('workspaces-updated', workspaceUpdateListener)
})

onUnmounted(() => {
  // Clean up event listener
  window.api.off('workspaces-updated', workspaceUpdateListener)
})

const loadWorkspaces = async () => {
  try {
    workspaces.value = window.api.workspace.list()
  } catch (error) {
    console.error('Failed to load workspaces:', error)
    workspaces.value = []
  }
}

const selectWorkspace = (workspaceId: string) => {
  if (workspaceId !== activeWorkspaceId.value) {
    store.activateWorkspace(workspaceId)
    emit('workspace-changed', workspaceId)
  }
}

const showWorkspaceEditor = () => {
  workspaceEditor.value?.show()
}

const onWorkspaceSave = async (workspace: any) => {
  // Save the workspace
  const success = window.api.workspace.save(workspace)
  if (success) {
    await loadWorkspaces()
    workspaceEditor.value?.close()
  }
}

const getContrastColor = (backgroundColor: string): string => {
  // Remove # if present
  const color = backgroundColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16)
  const g = parseInt(color.substring(2, 4), 16)
  const b = parseInt(color.substring(4, 6), 16)
  
  // Calculate luminance using the formula for relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.66 ? '#000000' : '#ffffff'
}

const contextMenuActions = [
  { label: t('common.edit'), action: 'edit' },
  { label: t('common.delete'), action: 'delete' }
]

const showWorkspaceContextMenu = (event: MouseEvent, workspace: WorkspaceHeader) => {
  selectedWorkspace.value = workspace
  showMenu.value = true
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false
}

const handleActionClick = async (action: string) => {
  closeContextMenu()
  
  if (action === 'edit') {
    editWorkspace()
  } else if (action === 'delete') {
    await deleteWorkspace()
  }
}

const editWorkspace = () => {
  if (selectedWorkspace.value) {
    // Convert WorkspaceHeader to full Workspace object
    const workspace = window.api.workspace.load(selectedWorkspace.value.uuid)
    if (workspace) {
      workspaceEditor.value?.show(workspace)
    }
  }
}

const deleteWorkspace = async () => {
  if (!selectedWorkspace.value) return
  
  const result = await Dialog.show({
    title: t('workspace.delete.confirm'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })

  if (result.isDismissed) {
    return
  }

  // Delete the workspace
  const success = window.api.workspace.delete(selectedWorkspace.value.uuid)
  if (success) {
    await loadWorkspaces()
    // If this was the active workspace, switch to another one
    if (selectedWorkspace.value.uuid === activeWorkspaceId.value) {
      const remainingWorkspaces = workspaces.value
      if (remainingWorkspaces.length > 0) {
        store.activateWorkspace(remainingWorkspaces[0].uuid)
        emit('workspace-changed', remainingWorkspaces[0].uuid)
      }
    }
  }
}
</script>

<style scoped>

.workspace-bar {
  
  display: flex;
  flex-direction: column;
  background-color: var(--menubar-bg-color);
  flex: 0 0 var(--window-menubar-width);

  .workspaces {
    
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--sidebar-border-color);
    gap: 0.5rem;
    align-items: center;
    padding-top: 1rem;
    padding-bottom: 0.5rem;

    .workspace-item {
      
      margin: 0.25rem;
      cursor: pointer;
      border-radius: 0.5rem;
      transition: all 0.2s ease;
      position: relative;
      padding: 2px;
      border: 2px solid transparent;
      
      &:hover {
        transform: scale(1.05);
      }
      
      &.active {
        border: 2px solid #A1A1AA;
      }
      
      &.add-workspace {
        .workspace-icon {
          border: 1px solid var(--control-border-color) !important;
          color: var(--text-color);
          
          &:hover {
            background-color: var(--menubar-highlight-color) !important;
            color: var(--background-color);
          }
        }
      }

      .workspace-icon {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--font-weight-semibold);
        font-size: 1rem;
        
        svg {
          width: var(--icon-lg);
          height: var(--icon-lg);
        }
        
        span {
          font-size: 1.2rem;
          font-weight: var(--font-weight-bold);
        }
      }

    }

  }

}

</style>