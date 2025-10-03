
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

    <main>
      <table class="table-plain table-plain-spaced">

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
          <tr v-for="agent in agents">
            <td>{{ agent.name }}</td>
            <td>{{ agent.description }}</td>
            <td>{{ t(`agent.forge.list.${agent.type}`) }}</td>
            <td>{{ lastRun(agent) }}</td>
            <td><div class="actions">
              <SpinningIcon v-if="startingAgents.includes(agent.uuid)" :spinning="true" class="run" />
              <PlayIcon v-else
                class="run"
                v-tooltip="{ text: t('agent.help.run'), position: 'top-left' }"
                @click.stop="onAgentRun(agent)"
              />
              <EyeIcon 
                class="view" 
                v-tooltip="{ text: t('agent.help.view'), position: 'top-left' }" 
                @click.stop="$emit('view', agent)" 
              />
              <ContextMenuTrigger position="below-right">
                <template #menu>
                  <div class="item edit" @click="$emit('edit', agent)">
                    {{ t('agent.help.edit') }}
                  </div>
                  <div class="item export" @click="$emit('export', agent)">
                    {{ t('agent.help.export') }}
                  </div>
                  <div class="item delete" @click="$emit('delete', agent)">
                    {{ t('agent.help.delete') }}
                  </div>
                </template>
              </ContextMenuTrigger>
            </div></td>
          </tr>
        </tbody>
      </table>
    </main>
  </div>
</template>

<script setup lang="ts">

import { EyeIcon, PlayIcon, PlusIcon, UploadIcon } from 'lucide-vue-next'
import { PropType, onMounted, onUnmounted, ref, watch } from 'vue'
import LogoA2A from '../../assets/a2a.svg?component'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import SpinningIcon from '../components/SpinningIcon.vue'
import { useTimeAgo } from '../composables/ago'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Agent, AgentRun } from '../types/index'

const emit = defineEmits(['create', 'view', 'edit', 'run', 'delete', 'export', 'importA2A', 'importJson'])

const props = defineProps({
  agents: Array as PropType<Agent[]>,
})

const runs = ref<Record<string, AgentRun[]>>({})
const startingAgents = ref<string[]>([])

onMounted(() => {
  loadAllRuns()
  watch(() => props.agents, loadAllRuns, { deep: true })
  window.api.on('agent-run-update', onAgentRunUpdate)
})

onUnmounted(() => {
  window.api.off('agent-run-update', onAgentRunUpdate)
})

const loadAllRuns = () => {
  if (!props.agents) return
  const newCache: Record<string, AgentRun[]> = {}
  for (const agent of props.agents) {
    newCache[agent.uuid] = window.api.agents.getRuns(store.config.workspaceId, agent.uuid)
  }
  runs.value = newCache
}

const onAgentRun = async (agent: Agent) => {
  emit('run', agent)
  startingAgents.value.push(agent.uuid)
  setTimeout(() => {
    const idx = startingAgents.value.indexOf(agent.uuid)
    if (idx !== -1) startingAgents.value.splice(idx, 1)
  }, 1000)
}

const onAgentRunUpdate = (data: { agentId: string }) => {
  if (data.agentId && runs.value[data.agentId] !== undefined) {
    runs.value[data.agentId] = window.api.agents.getRuns(store.config.workspaceId, data.agentId)
  }
}

const lastRun = (agent: Agent) => {
  const agentRuns = runs.value[agent.uuid] || []
  if (agentRuns.length === 0) return t('agent.history.neverRun')
  const lastRun = agentRuns[agentRuns.length - 1]
  if (lastRun.status === 'running') return t('agent.history.running')
  return useTimeAgo().format(new Date(lastRun.createdAt))
}

</script>

<style scoped>

.agents-list {

  header {
    border-bottom: none;
  }

  main {
    padding: 4rem;
  }

}

</style>