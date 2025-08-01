
<template>

  <div class="agent-view master-detail" v-if="agent">

    <div class="master-main">
      <Info class="agent-info" :agent="agent" :runs="runs" @run="emit('run', $event)" @edit="emit('edit', $event)" @delete="emit('delete', $event)" />
      <History class="agent-history" :agent="agent" :runs="runs" :run="run" :show-workflows="showWorkflows" @click="run = $event" @clear="clearHistory" @update:show-workflows="showWorkflows = $event" />
    </div>

    <div class="master-detail">
      <Run v-if="run" :agent-id="agent.id" :run-id="run.id" @close="run = null" @delete="deleteRun"/>
      <div v-else class="panel no-run">
        <div class="panel-header">
        </div>
        <div class="panel-body empty-state">
          {{ t('agent.run.selectRun') }}
        </div>
      </div>
    </div>

  </div>

</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, PropType, onMounted, watch, onUnmounted } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import Info from './Info.vue'
import History from './History.vue'
import Run from './Run.vue'

const runs = ref<AgentRun[]>([])
const run = ref<AgentRun|null>(null)
const showWorkflows = ref<'all' | 'exclude'>('exclude')

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: null,
  },
})

const emit = defineEmits(['run', 'edit', 'clearHistory', 'delete'])

onMounted(() => {
  watch(() => props.agent, reload, { immediate: true })
  watch(() => showWorkflows.value, selectLatestRun)
  window.api.on('agent-run-update', onAgentRunUpdate)
})

onUnmounted(() => {
  window.api.off('agent-run-update', onAgentRunUpdate)
})

const onAgentRunUpdate = (data: { agentId: string, runId: string }) => {
  if (props.agent && props.agent.id === data.agentId) {
    reload()
  }
}

const reload = () => {
  if (!props.agent) return
  runs.value = window.api.agents.getRuns(props.agent.id)
  
  // auto-adjust showWorkflows based on available runs
  const nonWorkflowRuns = runs.value.filter(run => run.trigger !== 'workflow')
  if (runs.value.length > 0 && nonWorkflowRuns.length === 0) {
    showWorkflows.value = 'all'
  } else if (nonWorkflowRuns.length > 0) {
    showWorkflows.value = 'exclude'
  }
  
  selectLatestRun()
}

const selectLatestRun = () => {
  const filteredRuns = showWorkflows.value === 'all' 
    ? runs.value 
    : runs.value.filter(run => run.trigger !== 'workflow')
  
  if (filteredRuns.length > 0) {
    run.value = filteredRuns[filteredRuns.length - 1]
  } else {
    run.value = null
  }
}

const deleteRun = () => {

  Dialog.show({
    title: t('agent.run.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.deleteRun(props.agent.id, run.value.id)
      runs.value = runs.value.filter(r => r.id !== run.value.id)
      selectLatestRun()
    }
  })
}

const clearHistory = () => {
  Dialog.show({
    title: t('agent.history.confirmClear'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.clear'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.deleteRuns(props.agent.id)
      runs.value = []
      run.value = null
    }
  })
}

</script>


<style scoped>

.agent-view {

  --agent-font-size: 11pt;

  margin: 2rem;
  gap: 2rem;

  .master-main {
    flex: 1 0 calc(50% - 1rem);
    max-width: min(calc(50% - 1rem), 450px);
    height: calc(100vh - var(--window-toolbar-height) - 4rem);
  }

  .master-detail {
    flex: 1 1 auto;
    min-width: 0;
    height: calc(100vh - var(--window-toolbar-height) - 4rem);
  }

  .master-main {

    display: flex;
    flex-direction: column;
    gap: 2rem;

    .agent-info {
      flex-shrink: 0;
    }

    .agent-history {
      flex-grow: 1;
    }
  }

  .panel {
    margin: 0rem;
    padding: 0rem;

    &:deep()  .panel-body {
      gap: 0rem;
      font-size: var(--agent-font-size);
    }

    &.no-run {
      width: 100%;
      .panel-body {
        justify-content: center;
        padding: 3rem;
        text-align: center;
        font-size: 18pt;
        color: var(--faded-text-color);
        font-family: var(--font-family-serif);
      }
    }

  }

}



</style>
