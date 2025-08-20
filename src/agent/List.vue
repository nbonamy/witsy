
<template>
  <div class="agents-list">

    <header>
      <div class="title">{{ t('agent.forge.title') }}</div>
      <div class="actions">
        <button class="large secondary" @click="emit('importA2A')"><LogoA2A />{{ t('agent.forge.a2a.title') }}</button>
        <button class="large primary" @click="emit('create')"><PlusIcon />{{ t('agent.forge.create') }}</button>
      </div>
    </header>

    <main>
      <table class="table-plain table-plain-spaced">

        <thead>
          <tr>
            <th>{{ t('agent.name') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('agent.history.lastRun') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="agent in agents">
            <td>{{ agent.name }}</td>
            <td>{{ t(`agent.forge.list.${agent.type}`) }}</td>
            <td>{{ lastRun(agent) }}</td>
            <td><div class="actions">
              <PlayIcon 
                class="run" 
                v-tooltip="{ text: t('agent.help.run'), position: 'top-left' }" 
                @click.stop="$emit('run', agent)" 
              />
              <EyeIcon 
                class="view" 
                v-tooltip="{ text: t('agent.help.view'), position: 'top-left' }" 
                @click.stop="$emit('view', agent)" 
              />
              <ContextMenuTrigger position="below-left">
                <template #menu="{ close }">
                  <div class="item" @click="close(); $emit('edit', agent)">
                    {{ t('agent.help.edit') }}
                  </div>
                  <div class="item" @click="close(); $emit('delete', agent)">
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

import { PlusIcon, PlayIcon, EyeIcon } from 'lucide-vue-next'
import { PropType } from 'vue'
import LogoA2A from '../../assets/a2a.svg?component'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import { useTimeAgo } from '../composables/ago'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Agent } from '../types/index'

const emit = defineEmits(['create', 'view', 'edit', 'run', 'delete', 'importA2A']) 

const props = defineProps({
  agents: Array as PropType<Agent[]>,
})

const lastRun = (agent: Agent) => {
  const runs = window.api.agents.getRuns(store.config.workspaceId, agent.uuid)
  if (runs.length === 0) return t('agent.history.neverRun')
  const lastRun = runs[runs.length - 1]
  return useTimeAgo().format(new Date(lastRun.createdAt))
}

</script>

<style scoped>

.agents-list {

  main {
    padding: 4rem;
  }
  
}

</style>