<template>

  <div class="workspace-bar">

    <div class="corner">
    </div>

    <div class="workspaces">
      <div 
        v-for="workspace in workspaces" 
        :key="workspace.uuid"
        class="workspace-item" 
        :class="{ active: workspace.uuid === activeWorkspaceId }"
        @click="selectWorkspace(workspace.uuid)"
        :title="workspace.name"
      >
        <div class="workspace-icon" :style="{ backgroundColor: workspace.color || '#007bff' }">
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
          <BIconPlus />
        </div>
      </div>

      <div class="push"></div>

      <div class="workspace-item">
        <div class="workspace-icon" :style="{ backgroundColor: 'rgb(28, 79, 178)' }">
          <BIconStarFill />
        </div>
      </div>

    </div>

    <WorkspaceEditor ref="workspaceEditor" @save="onWorkspaceSave" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { BIconPlus, BIconStarFill } from 'bootstrap-icons-vue'
import { WorkspaceHeader } from '../types/workspace'
import { store } from '../services/store'
import WorkspaceEditor from './WorkspaceEditor.vue'

const workspaces = ref<WorkspaceHeader[]>([])
const workspaceEditor = ref(null)

const activeWorkspaceId = computed(() => store.config.workspaceId)

const emit = defineEmits(['workspace-changed'])

onMounted(async () => {
  loadWorkspaces()
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
</script>

<style scoped>

.workspace-bar {
  
  display: flex;
  flex-direction: column;
  background-color: var(--menubar-bg-color);
  width: var(--window-menubar-width);

  .corner {
    background-color: var(--window-decoration-color);
    border-bottom: 1px solid var(--toolbar-border-color);
    width: var(--window-menubar-width);
    height: var(--window-toolbar-height);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .workspaces {
    
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--menubar-border-color);
    border-top: 1px solid var(--menubar-border-color);
    gap: 0.5rem;
    align-items: center;
    padding-top: 1rem;
    padding-bottom: 0.5rem;

    .push {
      flex: 1;
    }

    .workspace-item {
      
      margin: 0.25rem;
      cursor: pointer;
      border-radius: 0.5rem;
      transition: all 0.2s ease;
      position: relative;
      
      &:hover {
        transform: scale(1.05);
      }
      
      &.active {
        box-shadow: 0 0 0 2px var(--menubar-highlight-color);
      }
      
      &.add-workspace {
        .workspace-icon {
          background-color: var(--control-border-color) !important;
          color: var(--text-color);
          
          &:hover {
            background-color: var(--menubar-highlight-color) !important;
            color: var(--background-color);
          }
        }
      }

      .workspace-icon {
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 1rem;
        color: white;
        
        svg {
          width: 1.25rem;
          height: 1.25rem;
        }
        
        span {
          font-size: 1.2rem;
          font-weight: 700;
        }
      }

    }

  }

}

</style>