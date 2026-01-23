
<template>

  <div class="agent-view split-pane" v-if="agent">

    <!-- Left Pane: Runs List -->
    <div class="sp-sidebar">

      <header>

        <ChevronLeftIcon class="icon back" @click="emit('close')" />

        <div class="title">{{ agent.name }}</div>

        <div class="actions">

          <ButtonIcon class="run" v-tooltip="{ text: t('agent.help.run'), position: 'bottom-left' }" @click="emit('run', agent)">
            <PlayIcon />
          </ButtonIcon>

          <ContextMenuTrigger position="below-right">
            <template #menu>
              <div class="item edit" @click="emit('edit', agent)">
                <PencilIcon /> {{ t('agent.help.edit') }}
              </div>
              <div class="item delete danger" @click="emit('delete', agent)">
                <Trash2Icon /> {{ t('agent.help.delete') }}
              </div>
            </template>
          </ContextMenuTrigger>

        </div>
      
      </header>

      <main>
        <Info :agent="agent" :runs="runs" />
        <History :agent="agent" :runs="runs" :selection="selection.map(r => r.uuid)" :show-workflows="showWorkflows" @click="onClickRun" @clear="clearHistory" @update:show-workflows="showWorkflows = $event" @context-menu="showContextMenu" />
      </main>

    </div>

    <!-- Run View: Execution Flow + Details -->
    <Run
      :agent="agent"
      :run="selection.length === 1 ? selection[0] : null"
      @delete="deleteRuns"
    />

    <ContextMenuPlus v-if="showMenu" @close="closeContextMenu" :mouseX="menuX" :mouseY="menuY">
      <div class="item" :class="{ disabled: selection.length === 0 && !targetRun }" @click="(selection.length > 0 || targetRun) && handleActionClick('delete')">
        {{ t('common.delete') }}
      </div>
    </ContextMenuPlus>

  </div>

</template>

<script setup lang="ts">

import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { ChevronLeftIcon, PencilIcon, PlayIcon, Trash2Icon } from 'lucide-vue-next'
import { Agent, AgentRun } from 'types/agents'
import { PropType, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import History from './History.vue'
import Info from './Info.vue'
import Run from './Run.vue'

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
  watch(() => props.agent, () => reload(), { immediate: true })
  watch(() => showWorkflows.value, () => selectLatestRun())
  window.api.on('agent-run-update', onAgentRunUpdate)
})

onBeforeUnmount(() => {
  window.api.off('agent-run-update', onAgentRunUpdate)
})

const onAgentRunUpdate = (data: { agentId: string, runId: string }) => {
  if (props.agent && props.agent.uuid === data.agentId) {
    reload(data.runId)
  }
}

const reload = (selectRunId?: string) => {

  if (!props.agent) return
  runs.value = window.api.agents.getRuns(store.config.workspaceId, props.agent.uuid)

  // auto-adjust showWorkflows based on available runs
  const nonWorkflowRuns = runs.value.filter(run => run.trigger !== 'workflow')
  if (runs.value.length > 0 && nonWorkflowRuns.length === 0) {
    showWorkflows.value = 'all'
  } else if (nonWorkflowRuns.length > 0) {
    showWorkflows.value = 'exclude'
  }

  selectLatestRun(selectRunId)
}

const selectLatestRun = (selectRunId?: string) => {

  // If a specific run ID is provided, select it
  if (selectRunId) {
    const targetRun = runs.value.find(r => r.uuid === selectRunId)
    if (targetRun) {
      selection.value = [targetRun]
      return
    }
  }

  const filtered = showWorkflows.value === 'all'
    ? runs.value
    : runs.value.filter(run => run.trigger !== 'workflow')

  if (filtered.length > 0) {
    const latestRun = filtered[filtered.length - 1]
    if (selection.value.length === 0) {
      selection.value = [latestRun]
      return
    } else if (selection.value.length === 1 && selection.value[0].uuid === latestRun.uuid) {
      selection.value = [latestRun]
      return
    }
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

  background-color: var(--background-color);
  color: var(--text-color);

  .sp-sidebar {
    flex: 0 0 calc(var(--large-panel-width) * 1.1);
    min-height: 0;

    header .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    main {
      min-height: 0;
      padding: 0 1rem;
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }

    :deep(.history) {
      flex: 1;
      min-height: 0;
    }
  }

}

</style>
