<template>
  <div class="empty">
    
    <h1>{{ t('chat.empty.greeting') }}</h1>
    
    <div class="shortcuts">

      <template  v-if="shortcuts.length">

        <div class="shortcuts-header">

          {{ t('common.agents')}}

          <div class="icon" v-if="!showAllShortcuts" @click="showAllShortcuts = true">
            {{ t('common.showMore') }}
            <ChevronDownIcon />
          </div>

          <div class="icon" v-else @click="showAllShortcuts = false">
            {{ t('common.showLess') }}
            <ChevronUpIcon />
          </div>

        </div>

        <div class="shortcuts-list">
          <HomeShortcut
            v-for="shortcut in shortcuts"
            :key="shortcut.name"
            :name="shortcut.name"
            :description="shortcut.description"
            @run="shortcut.run"
          />
        </div>

      </template>

      <div class="shortcuts-list" v-else>
          <HomeShortcut
            key="agentForge"
            :name="t('agent.forge.title')"
            :description="t('chat.empty.agentForge')"
            @run="openAgentForge"
          />
          <HomeShortcut
            key="mcpServer"
            :icon="PlugIcon"
            :name="t('mcp.mcpServers')"
            :description="t('chat.empty.mcpServers')"
            @run="openMcpServers"
          />
          <HomeShortcut
            key="docRepo"
            :icon="LightbulbIcon"
            :name="t('common.docRepo')"
            :description="t('chat.empty.docRepo')"
            @run="openDocRepo"
          />

        </div>

    </div>

  </div>
</template>

<script setup lang="ts">


import { ChevronDownIcon, ChevronUpIcon, LightbulbIcon, PlugIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Agent } from '../types/index'
import HomeShortcut from './HomeShortcut.vue'
import useEventBus from '../composables/event_bus'

type Shortcut = {
  name: string
  description: string
  run: () => void
}

const emit = defineEmits(['run-agent'])

const shortcuts = computed((): Shortcut[] => {

  const lastRuns: Record<string, number> = {}

  const getLastRun = (agent: Agent) => {
    if (!store.workspace) return agent.createdAt
    const runs = window.api.agents.getRuns(store.workspace.uuid, agent.uuid)
    return runs.length > 0 ? runs[runs.length - 1].createdAt : agent.createdAt
  }

  return store.agents.sort((a, b) => {

    if (!lastRuns[a.uuid]) {
      lastRuns[a.uuid] = getLastRun(a)
    }

    if (!lastRuns[b.uuid]) {
      lastRuns[b.uuid] = getLastRun(b)
    }

    return lastRuns[b.uuid] - lastRuns[a.uuid]

  }).map((a) => ({
    name: a.name,
    description: a.description,
    run: () => {
      emit('run-agent', a.uuid)
    }
  })).slice(0, showAllShortcuts.value ? undefined : 3);

});

const showAllShortcuts = ref(false)

const openAgentForge = () => {
  useEventBus().emitEvent('set-main-window-mode', 'agents')
}

const openMcpServers = () => {
  useEventBus().emitEvent('set-main-window-mode', 'mcp')
}

const openDocRepo = () => {
  useEventBus().emitEvent('set-main-window-mode', 'docrepos')
}

</script>


<style scoped>

.empty {
  width: 75%;
  min-width: 300px;
  max-width: 600px;
  align-self: center;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;

  color: var(--text-color);

  h1 {
    font-size: 24px;
    font-weight: var(--font-weight-medium);
  }

  .shortcuts {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;

    .shortcuts-header {

      width: 100%;
      display: flex;
      flex-direction: row;

      font-size: 14px;
      font-weight: 500;

      .icon {

        display: flex;
        align-items: center;
        cursor: pointer;
        margin-left: auto;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-primary);
        gap: 0.25rem;

        svg {
          fill: var(--color-primary);
        }
      }


    }

    .shortcuts-list {

      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;

      overflow-y: auto;
      max-height: 400px;

      &:nth-child(n+3) {
        display: none;
      }

    }
  }
}

</style>
