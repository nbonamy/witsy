
<template>

  <div class="runs panel">

    <div class="panel-header">
      <label>{{ t('agent.view.history') }}</label>
      <select v-model="showWorkflows" class="history-filter">
        <option value="all">{{ t('agent.view.filter.all') }}</option>
        <option value="exclude">{{ t('agent.view.filter.exclude_workflow') }}</option>
      </select>
      <ButtonIcon 
        class="clear"
        v-tooltip="{ text: t('agent.help.clearHistory'), position: 'bottom-left' }"
        @click="$emit('clear')"
      ><CalendarXIcon /></ButtonIcon>
    </div>

    <div class="panel-body">

      <div class="empty" v-if="filteredRuns.length === 0">
        {{ t('agent.history.empty') }}
      </div>

      <div class="sticky-table-container" v-else>
        <table class="table-plain">
          <thead>
            <tr>
              <th>{{ t('agent.history.date') }}</th>
              <th>{{ t('agent.history.trigger') }}</th>
              <th>{{ t('agent.history.status') }}</th>
              <th>{{ t('agent.history.log') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="spacer"></tr>
            <tr :class="{ selected: selection.includes(run.uuid) }" v-for="run in filteredRuns" :key="run.uuid" @click="$emit('click', $event, run)" @contextmenu.prevent="showContextMenu($event, run)">
              <td class="date">{{ timeAgo.format(new Date(run.createdAt)) }}</td>
              <td class="trigger">{{ t(`agent.trigger.${run.trigger}`) }}</td>
              <td class="status">{{ t(`agent.status.${run.status}`) }}</td>
              <td class="view"><EyeIcon /> </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

  </div>

</template>

<script setup lang="ts">

import { CalendarXIcon, EyeIcon } from 'lucide-vue-next';
import { PropType, computed } from 'vue';
import ButtonIcon from '../components/ButtonIcon.vue';
import { useTimeAgo } from '../composables/ago';
import { t } from '../services/i18n';
import { Agent, AgentRun } from '../types/agents';

const timeAgo = useTimeAgo()

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true
  },
  runs: {
    type: Array as PropType<AgentRun[]>,
    required: true,
  },
  selection: {
    type: Array as PropType<string[]>,
    required: true,
  },
  showWorkflows: {
    type: String as PropType<'all' | 'exclude'>,
    required: true,
  },
})

const emit = defineEmits(['clear', 'click', 'update:show-workflows', 'context-menu'])

// Computed property for two-way binding with parent
const showWorkflows = computed({
  get: () => props.showWorkflows,
  set: (value: 'all' | 'exclude') => emit('update:show-workflows', value)
})

// Computed property to filter runs
const filteredRuns = computed(() => {
  const runsToShow = props.showWorkflows === 'all' 
    ? props.runs 
    : props.runs.filter(run => run.trigger !== 'workflow')
  
  return [...runsToShow].reverse()
})

const showContextMenu = (event: MouseEvent, run: AgentRun) => {
  emit('context-menu', { event, run })
}

</script>

<style scoped>

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-filter {
  width: auto;
  flex: 0 1 auto;
}

.empty {
  padding: 3rem;
  text-align: center;
  font-size: 24px;
  color: var(--faded-text-color);
  font-family: var(--font-family-serif);
}

.sticky-table-container {
  
  table {

    tr {
      cursor: pointer;
    }

    th, td {
      padding: 0.375rem 0.5rem;
    }

    td.view {
      svg {
        position: relative;
        top: 2px;
      }
    }

  }

}
</style>
