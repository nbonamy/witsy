
<template>

  <div class="agent-view" v-if="agent">

    <header>
      <ChevronLeftIcon class="icon back" @click="emit('close')" />
      <div class="title">{{ agent.name }}</div>
    </header>

    <main>

      <div class="master-detail">

        <div class="md-master">
          <Info class="agent-info" :agent="agent" :runs="runs" @run="emit('run', $event)" @edit="emit('edit', $event)" @delete="emit('delete', $event)" />
          <History class="agent-history" :agent="agent" :runs="runs" :selection="selection.map(r => r.uuid)" :show-workflows="showWorkflows" @click="onClickRun" @clear="clearHistory" @update:show-workflows="showWorkflows = $event" @context-menu="showContextMenu" />
        </div>

        <div class="md-detail">
          <Run v-if="selection.length === 1" :agent-id="agent.uuid" :run-id="selection[0].uuid" @close="selection = []" @delete="deleteRuns"/>
          <div v-else class="panel no-run">
            <div class="panel-header">
            </div>
            <div class="panel-body empty-state">
              {{ t('agent.run.selectRun') }}
            </div>
          </div>
        </div>

      </div>

    </main>

    <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
  
  </div>

</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, PropType, onMounted, watch, onUnmounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import Info from './Info.vue'
import History from './History.vue'
import Run from './Run.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { ChevronLeftIcon } from 'lucide-vue-next'

const runs = ref<AgentRun[]>([])
const selection = ref<AgentRun[]>([])
const showWorkflows = ref<'all' | 'exclude'>('exclude')

// Context menu state
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRun = ref<AgentRun|null>(null)

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: null,
  },
})

const emit = defineEmits(['close', 'run', 'edit', 'delete'])

onMounted(() => {
  watch(() => props.agent, reload, { immediate: true })
  watch(() => showWorkflows.value, selectLatestRun)
  window.api.on('agent-run-update', onAgentRunUpdate)
})

onUnmounted(() => {
  window.api.off('agent-run-update', onAgentRunUpdate)
})

const onAgentRunUpdate = (data: { agentId: string, runId: string }) => {
  if (props.agent && props.agent.uuid === data.agentId) {
    reload()
  }
}

const reload = () => {
  if (!props.agent) return
  runs.value = window.api.agents.getRuns(store.config.workspaceId, props.agent.uuid)
  
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
    selection.value = [filteredRuns[filteredRuns.length - 1]]
  } else {
    selection.value = []
  }
}

const onClickRun = (event: MouseEvent, run: AgentRun) => {
  if (event.ctrlKey || event.metaKey) {
    if (selection.value.includes(run)) {
      selection.value = selection.value.filter(r => r !== run)
    } else {
      selection.value.push(run)
    }
  } else {
    selection.value = [run]
  }
}

const deleteRuns = () => {

  Dialog.show({
    title: selection.value.length > 1
    ? t('agent.history.confirmDeleteMultiple')
    : t('agent.history.confirmDeleteSingle'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      for (const run of selection.value) {
        window.api.agents.deleteRun(store.config.workspaceId, props.agent.uuid, run.uuid)
      }
      runs.value = runs.value.filter(r => !selection.value.includes(r))
      selectLatestRun()
    }
  })
}

const showContextMenu = ({ event, run }: { event: MouseEvent, run: AgentRun }) => {
  showMenu.value = true
  targetRun.value = run
  if (!selection.value.includes(run)) {
    selection.value = [run]
  }
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false
}

const contextMenuActions = () => {
  const selectedCount = selection.value.length > 0 ? selection.value.length : (targetRun.value ? 1 : 0)
  
  return [
    { label: t('common.delete'), action: 'delete', disabled: selectedCount === 0 },
  ]
}

const handleActionClick = async (action: string) => {
  
  // close
  closeContextMenu()

  // process
  if (action === 'delete') {
    deleteRuns()
  }
}

const clearHistory = () => {
  Dialog.show({
    title: t('agent.history.confirmClear'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.clear'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.deleteRuns(store.config.workspaceId, props.agent.uuid)
      runs.value = []
      selection.value = []
    }
  })
}

</script>


<style scoped>

.agent-view {

  --agent-font-size: 14.5px;

  main {

    padding: 2rem !important;

    .master-detail {
      gap: 1rem;
    }
  
    .md-master {
      flex: 1 0 calc(50% - 4rem);
      max-width: min(calc(50% - 4rem), 450px);
      padding: 0;
    }

    .md-detail {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0;
    }

    .md-master {

      display: flex;
      flex-direction: column;
      gap: 2rem;

      border: none;

      .agent-info {
        flex-shrink: 0;
      }

      .agent-history {
        flex-grow: 1;
      }
    }

    .panel {

      &:deep() .panel-body {
        gap: 0rem;
        font-size: var(--agent-font-size);
      }

      &.no-run {
        width: 100%;
        .panel-body {
          justify-content: center;
          padding: 3rem;
          text-align: center;
          font-size: 24px;
          color: var(--faded-text-color);
          font-family: var(--font-family-serif);
        }
      }

    }

    .md-detail .panel {
      box-sizing: border-box;
      height: 100%;
    }

  }

}



</style>
