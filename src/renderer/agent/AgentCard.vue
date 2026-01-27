<template>
  <div class="agent-card">
    <div class="card-content">
      <div class="card-body">
        <div class="agent-text">
          <h3>{{ agent.name }}</h3>
          <p>{{ agent.description }}</p>
        </div>
        <div class="agent-avatar">
          <IconAgent />
        </div>
      </div>
    </div>
    <div class="card-footer">
      <button type="button" class="secondary" @click="emit('run', agent)">
        <SpinningIcon v-if="starting" :spinning="true" />
        <PlayIcon v-else />
        {{ t('agent.forge.run') }}
        <span v-if="runningCount > 0" class="running-badge">{{ runningCount }}</span>
      </button>
      <AgentExecutionsMenu
        v-if="runningCount > 0"
        variant="button"
        :executions="runningExecutions"
        @stop="emit('stop', $event)"
      />
      <button type="button" class="secondary" @click="emit('view', agent)">
        <EyeIcon />
        {{ t('agent.forge.view') }}
      </button>
      <AgentMenu
        :agent="agent"
        position="below-right"
        @edit="emit('edit', $event)"
        @export="emit('export', $event)"
        @duplicate="emit('duplicate', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">

import { EyeIcon, PlayIcon } from 'lucide-vue-next'
import { Agent } from 'types/agents'
import IconAgent from '@assets/agent.svg?component'
import AgentExecutionsMenu from './AgentExecutionsMenu.vue'
import AgentMenu from './AgentMenu.vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import { t } from '@services/i18n'

const props = defineProps<{
  agent: Agent
  starting: boolean
  runningCount: number
  runningExecutions: Array<{ id: string, agent: Agent }>
}>()

const emit = defineEmits<{
  run: [agent: Agent]
  view: [agent: Agent]
  edit: [agent: Agent]
  export: [agent: Agent]
  duplicate: [agent: Agent]
  delete: [agent: Agent]
  stop: [executionId: string]
}>()

</script>

<style scoped>

.agent-card {
  width: 340px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-content {
  background-color: var(--color-surface-lowest);
  padding: var(--space-12);
  min-height: 80px;
}

.card-body {
  display: flex;
  gap: var(--space-12);
}

.agent-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: var(--space-8);
  gap: var(--space-2);
}

.agent-text h3 {
  font: var(--text-label-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  line-clamp: 1;
}

.agent-text p {
  font: var(--text-body-sm);
  color: var(--color-text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  background-color: var(--color-tertiary);
  color: var(--color-on-tertiary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-avatar svg {
  width: 20px;
  height: 20px;
}

.card-footer {
  background-color: var(--color-surface);
  padding: var(--space-8) var(--space-12);
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.card-footer button {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: 32px;
  padding: var(--space-4) var(--space-8);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background-color: transparent;
  font: var(--text-button-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.card-footer button:hover {
  background-color: var(--color-primary-container);
}

.running-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  padding: 2px 5px;
  border-radius: var(--radius-full);
  min-width: 18px;
  text-align: center;
  line-height: 1.2;
  border: 2px solid var(--color-surface);
}

.card-footer button svg {
  width: 16px;
  height: 16px;
}

.card-footer :deep(.context-menu-trigger) {
  margin-left: auto;
}

</style>
