
<template>
  <div class="agents-list">

    <header>
      <div class="title">{{ t('agent.forge.title') }}</div>
      <div class="actions">
        <button name="import-json" class="large secondary" @click="emit('importJson')"><UploadIcon />{{ t('agent.help.import') }}</button>
        <button name="import-a2a" class="large secondary" @click="emit('importA2A')"><LogoA2A />{{ t('agent.forge.a2a.title') }}</button>
        <button name="create" class="large primary" @click="emit('create')"><PlusIcon />{{ t('agent.forge.create') }}</button>
      </div>
    </header>

    <main class="list-with-toolbar">

      <div class="toolbar">
        <div class="functional-controls"></div>
        <div class="actions">
          <ButtonIcon
            v-if="viewMode === 'table'"
            v-tooltip="{ text: t('agent.forge.viewCards'), position: 'top-left' }"
            @click="setViewMode('cards')"
          ><LayoutGridIcon /></ButtonIcon>
          <ButtonIcon
            v-else
            v-tooltip="{ text: t('agent.forge.viewTable'), position: 'top-left' }"
            @click="setViewMode('table')"
          ><ListIcon /></ButtonIcon>
        </div>
      </div>

      <!-- Table View -->
      <table v-if="viewMode === 'table'" class="table-plain">

        <thead>
          <tr>
            <th>{{ t('agent.name') }}</th>
            <th>{{ t('agent.description') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('agent.history.lastRun') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="agent in agents.sort((a: Agent, b: Agent) => a.name.localeCompare(b.name))" :key="`${agent.uuid}-${agent.lastRunId}`">
            <td>{{ agent.name }}</td>
            <td>{{ agent.description }}</td>
            <td>{{ t(`agent.forge.list.${agent.type}`) }}</td>
            <td>{{ lastRun(agent) }}</td>
            <td><div class="actions">
              <SpinningIcon v-if="startingAgents.includes(agent.uuid)" :spinning="true" class="run" />
              <ButtonIcon v-else
                class="run"
                v-tooltip="{ text: t('agent.help.run'), position: 'top-left' }"
                @click="onAgentRun(agent)"
              ><PlayIcon /></ButtonIcon>
              <ButtonIcon
                class="view"
                v-tooltip="{ text: t('agent.help.view'), position: 'top-left' }"
                @click="$emit('view', agent)"
              ><EyeIcon /></ButtonIcon>
              <AgentMenu
                :agent="agent"
                position="below-right"
                @edit="$emit('edit', $event)"
                @export="$emit('export', $event)"
                @duplicate="$emit('duplicate', $event)"
                @delete="$emit('delete', $event)"
              />
            </div></td>
          </tr>
        </tbody>
      </table>

      <!-- Card View -->
      <div v-else class="agents-grid">
        <AgentCard
          v-for="agent in agents.sort((a: Agent, b: Agent) => a.name.localeCompare(b.name))"
          :key="`${agent.uuid}-${agent.lastRunId}`"
          :agent="agent"
          :starting="startingAgents.includes(agent.uuid)"
          @run="onAgentRun"
          @view="$emit('view', $event)"
          @edit="$emit('edit', $event)"
          @export="$emit('export', $event)"
          @duplicate="$emit('duplicate', $event)"
          @delete="$emit('delete', $event)"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { EyeIcon, LayoutGridIcon, ListIcon, PlayIcon, PlusIcon, UploadIcon } from 'lucide-vue-next'
import { Agent } from 'types/agents'
import { onMounted, ref, watch } from 'vue'
import LogoA2A from '@assets/a2a.svg?component'
import AgentCard from './AgentCard.vue'
import AgentMenu from './AgentMenu.vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import { useTimeAgo } from '@composables/ago'
import { t } from '@services/i18n'
import { store } from '@services/store'

type ViewMode = 'table' | 'cards'
const STORAGE_KEY = 'agentForgeViewMode'

const emit = defineEmits(['create', 'view', 'edit', 'run', 'delete', 'duplicate', 'export', 'importA2A', 'importJson'])

const agents = ref<Agent[]>([])
const startingAgents = ref<string[]>([])
const viewMode = ref<ViewMode>((localStorage.getItem(STORAGE_KEY) as ViewMode) || 'table')

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  localStorage.setItem(STORAGE_KEY, mode)
}

onMounted(() => {
  load()
  watch(() => store.agents, load)
})

const load = () => {
  agents.value = store.agents.sort((a: Agent, b: Agent) => a.name.localeCompare(b.name))
}

const onAgentRun = async (agent: Agent) => {
  emit('run', agent)
  startingAgents.value.push(agent.uuid)
  setTimeout(() => {
    const idx = startingAgents.value.indexOf(agent.uuid)
    if (idx !== -1) startingAgents.value.splice(idx, 1)
  }, 1000)
}

const lastRun = (agent: Agent) => {
  if (!agent.lastRunId) return t('agent.history.neverRun')
  const agentRun = window.api.agents.getRun(store.config.workspaceId, agent.uuid, agent.lastRunId)
  if (!agentRun) return t('agent.history.neverRun')
  if (agentRun.status === 'running') return t('agent.history.running')
  return useTimeAgo().format(new Date(agentRun.createdAt))
}

</script>

<style scoped>

@import '@css/list-with-toolbar.css';

.agents-list {

  header {
    border-bottom: none;

    button[name=import-a2a] svg {
      color: var(--color-primary);
    }
  }

  main {
    padding: 2rem 4rem 4rem 4rem;
  }

  table.table-plain {
    display: table;
    table-layout: fixed;
    flex: none;

    thead, tbody {
      display: table-header-group;
    }

    tbody {
      display: table-row-group;
    }

    th:nth-child(1), td:nth-child(1) { width: auto; }
    th:nth-child(2), td:nth-child(2) { width: 300px; }
    th:nth-child(3), td:nth-child(3) { width: 100px; }
    th:nth-child(4), td:nth-child(4) { width: 120px; }
    th:nth-child(5), td:nth-child(5) { width: 140px; }

    td:nth-child(1),
    td:nth-child(2) {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .agents-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-12);
  }

}

</style>