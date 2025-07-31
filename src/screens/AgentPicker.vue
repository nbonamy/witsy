<template>
  <ModalDialog id="agent-picker" ref="dialog">
    <template #header>
      {{ t('agent.picker.title') }}
    </template>
    <template #body>
      <div class="agent-list">
        <div v-for="agent in runnableAgents" :key="agent.id" class="agent-item" @click="onSelectAgent(agent)">
          <div class="agent-icon">
            <BIconRobot v-if="agent.source === 'witsy'" />
            <LogoA2A v-else-if="agent.source === 'a2a'" />
          </div>
          <div class="agent-info">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-description">{{ agent.description }}</div>
          </div>
        </div>
        <div v-if="!runnableAgents.length" class="no-agents">
          {{ t('agent.picker.noAgents') }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Agent } from '../types/index'
import ModalDialog from '../components/ModalDialog.vue'
import LogoA2A from '../../assets/a2a.svg?component'

const dialog = ref(null)
let resolveCallback: ((agent: Agent | null) => void) | null = null

const runnableAgents = computed(() => 
  store.agents.filter(agent => agent.type === 'runnable')
)

const onSelectAgent = (agent: Agent) => {
  if (resolveCallback) {
    resolveCallback(agent)
    resolveCallback = null
  }
  close()
}

const close = () => {
  if (resolveCallback) {
    resolveCallback(null)
    resolveCallback = null
  }
  dialog.value.close()
}

const onCancel = () => {
  close()
}

defineExpose({
  pick: (): Promise<Agent | null> => {
    return new Promise((resolve) => {
      resolveCallback = resolve
      dialog.value.show()
    })
  },
  close,
})

</script>

<style>

#agent-picker .swal2-popup {
  
  max-width: 36rem !important;

  .agent-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--control-list-border-color);
    border-radius: 0.5rem;
  }

  .agent-item {
    
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    cursor: pointer;
    border-bottom: 1px solid var(--control-list-border-color);
    transition: background-color 0.15s ease;
    gap: 1.5rem;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background-color: var(--highlight-color);
      color: white;
      .agent-icon svg {
        fill: white;
      }
    }
  }

  .agent-icon {
    flex-shrink: 0;
    svg {
      width: 1.5rem;
      height: 1.5rem;
      fill: var(--text-color);
    }
  }

  .agent-info {
    
    flex: 1;
    min-width: 0;
    text-align: left;
    gap: 0.25rem;

    .agent-name {
      font-weight: 600;
      font-size: 11.5pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-description {
      font-size: 10.5pt;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

  }

  .no-agents {
    text-align: center;
    color: var(--dimmed-text-color);
    padding: 2rem;
    font-style: italic;
  }

}

</style>
