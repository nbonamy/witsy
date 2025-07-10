
<template>

  <div class="runs sticky-table-container">
    
    <table>
      <thead>
        <tr>
          <th>{{ t('agent.history.date') }}</th>
          <th>{{ t('agent.history.trigger') }}</th>
          <th>{{ t('agent.history.prompt') }}</th>
          <th>{{ t('agent.history.status') }}</th>
          <th>{{ t('agent.history.duration') }}</th>
          <th>{{ t('agent.history.log') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run in [...runs].reverse()" :key="run.id">
          <td>{{ new Date(run.createdAt).toLocaleString() }}</td>
          <td>{{ run.trigger }}</td>
          <td>{{ run.prompt }}</td>
          <td>{{ run.status }}</td>
          <td>{{ Math.ceil((run.updatedAt - run.createdAt) / 1000) }} s</td>
          <td>{{ t('agent.history.log') }}</td>
        </tr>
      </tbody>
    </table>

    <div class="empty" v-if="runs.length === 0">
      {{ t('agent.history.empty') }}
    </div>

  </div>

</template>

<script setup lang="ts">

import { Agent, AgentRun } from '../types/index';
import { PropType } from 'vue'
import { t } from '../services/i18n'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true
  },
  runs: {
    type: Array as PropType<AgentRun[]>,
    required: true,
  }
})

</script>

<style scoped>
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

.sticky-table-container {
  
  table {

    th, td {
      font-size: 10.5pt !important;
    }

    th {
      font-weight: bold;
    }

  }

  .empty {
    padding-top: 64px;
    text-align: center;
    font-size: 18pt;
    opacity: 0.5;
    font-family: var(--serif-font);
  }


}
</style>
