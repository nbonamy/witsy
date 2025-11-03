
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
      <table class="table-plain">

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
          <tr v-for="agent in store.agents" :key="`${agent.uuid}-${agent.lastRunId}`">
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
              <ContextMenuTrigger position="below-right">
                <template #menu>
                  <div class="item edit" @click="$emit('edit', agent)">
                    {{ t('agent.help.edit') }}
                  </div>
                  <div class="item export" @click="$emit('export', agent)">
                    {{ t('agent.help.export') }}
                  </div>
                  <div class="item duplicate" @click="$emit('duplicate', agent)">
                    {{ t('agent.help.duplicate') }}
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
import { PropType, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import LogoA2A from '../../assets/a2a.svg?component'
import ButtonIcon from '../components/ButtonIcon.vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import SpinningIcon from '../components/SpinningIcon.vue'
import { useTimeAgo } from '../composables/ago'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Agent, AgentRun } from '../types/agents'

const emit = defineEmits(['create', 'view', 'edit', 'run', 'delete', 'duplicate', 'export', 'importA2A', 'importJson'])

const startingAgents = ref<string[]>([])

onMounted(() => {
  store.loadAgents()
  window.api.on('agent-run-update', onAgentRunUpdate)
})

onBeforeUnmount(() => {
  window.api.off('agent-run-update', onAgentRunUpdate)
})

const onAgentRun = async (agent: Agent) => {
  emit('run', agent)
  startingAgents.value.push(agent.uuid)
  setTimeout(() => {
    const idx = startingAgents.value.indexOf(agent.uuid)
    if (idx !== -1) startingAgents.value.splice(idx, 1)
  }, 1000)
}

const onAgentRunUpdate = (data: { agentId: string }) => {
  store.loadAgents()
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

.agents-list {

  header {
    border-bottom: none;
  }

  main {
    padding: 4rem;
  }

}

</style>