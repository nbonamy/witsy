
<template>

  <div class="runs panel">

    <div class="panel-header">
      <label>{{ t('agent.view.history') }}</label>
      <select v-model="showWorkflows" class="history-filter">
        <option value="all">{{ t('agent.view.filter.all') }}</option>
        <option value="exclude">{{ t('agent.view.filter.exclude_workflow') }}</option>
      </select>
      <BIconCalendarX 
        class="icon clear" 
        v-tooltip="{ text: t('agent.help.clearHistory'), position: 'bottom-left' }" 
        @click="$emit('clear')" 
      />
    </div>

    <div class="panel-body">

      <div class="empty" v-if="filteredRuns.length === 0">
        {{ t('agent.history.empty') }}
      </div>

      <div class="sticky-table-container" v-else>
        
        <table>
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
            <tr :class="{ selected: run.id === props.run?.id }" v-for="run in filteredRuns" :key="run.id" @click="$emit('click', run)">
              <td class="date">{{ timeAgo.format(new Date(run.createdAt)) }}</td>
              <td class="trigger">{{ t(`agent.trigger.${run.trigger}`) }}</td>
              <td class="status">{{ t(`agent.status.${run.status}`) }}</td>
              <td class="view"><BIconSearch /> </td>
            </tr>
          </tbody>
        </table>

      </div>

    </div>

  </div>

</template>

<script setup lang="ts">

import { Agent, AgentRun } from '../types/index';
import { PropType, ref, computed } from 'vue'
import { t } from '../services/i18n'
import { useTimeAgo } from '../composables/ago'

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
  run: {
    type: Object as PropType<AgentRun|null>,
    default: null,
  },
  showWorkflows: {
    type: String as PropType<'all' | 'exclude'>,
    required: true,
  },
})

const emit = defineEmits(['clear', 'click', 'update:show-workflows'])

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
  font-size: 18pt;
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
      border: none;
      vertical-align: middle;
    }

    th {
      font-weight: bold;
      border-bottom: 1px solid var(--text-color);
    }

    td.view {
      svg {
        position: relative;
        top: 2px;
      }
    }

    tr.selected td:first-child {
      border-top-left-radius: 0.5rem;
      border-bottom-left-radius: 0.5rem;
    }

    tr.selected td:last-child {
      border-top-right-radius: 0.5rem;
      border-bottom-right-radius: 0.5rem;
    }

    tr.spacer {
      height: 0.25rem;
      background-color: var(--background-color);
    }

  }


}
</style>
