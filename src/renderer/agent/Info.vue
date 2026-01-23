
<template>

  <div class="agent-info">

    <!-- Total Runs -->
    <div class="stat-card">
      <div class="stat-icon"><ActivityIcon /></div>
      <div class="stat-content">
        <div class="stat-value">{{ completedRuns.length }}</div>
        <div class="stat-label">{{ t('agent.info.totalRuns') }}</div>
      </div>
    </div>

    <!-- Success Rate -->
    <div class="stat-card" v-if="completedRuns.length > 0">
      <div class="stat-icon"><CheckCircle2Icon /></div>
      <div class="stat-content">
        <div class="stat-value">{{ successPercentage.toFixed(0) }}%</div>
        <div class="stat-label">{{ t('agent.info.successRate') }}</div>
      </div>
      <div class="stat-bar">
        <div class="bar-fill success" :style="{ width: successPercentage + '%' }"></div>
        <div class="bar-fill error" :style="{ width: errorPercentage + '%' }"></div>
      </div>
      <div class="stat-legend">
        <div class="legend-item">
          <span class="legend-dot success"></span>
          <span>{{ successCount }} {{ t('agent.info.successful') }}</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot error"></span>
          <span>{{ errorCount }} {{ t('agent.info.failed') }}</span>
        </div>
      </div>
    </div>

    <!-- Next Run (if scheduled) -->
    <div class="stat-card" v-if="agent.schedule">
      <div class="stat-icon"><CalendarClockIcon /></div>
      <div class="stat-content">
        <div class="stat-value">{{ nextRunShort }}</div>
        <div class="stat-label">{{ t('agent.info.nextRun') }}</div>
      </div>
    </div>

    <!-- Debug Info -->
    <div v-if="isDebug" class="debug-info">
      <code>{{ agent.uuid }}</code>
    </div>

  </div>

</template>

<script setup lang="ts">

import { t } from '@services/i18n'
import { ActivityIcon, CalendarClockIcon, CheckCircle2Icon } from 'lucide-vue-next'
import { CronExpressionParser } from 'cron-parser'
import { Agent, AgentRun } from 'types/agents'
import { PropType, computed } from 'vue'

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

const isDebug = computed(() => {
  return window.api.debug.isDebug
})

const nextRunShort = computed(() => {
  if (!props.agent.schedule) return ''
  const schedule = CronExpressionParser.parse(props.agent.schedule)
  const next = schedule.next().toDate()
  return next.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
})

const completedRuns = computed(() => {
  return props.runs.filter(run => run.status !== 'running')
})

const successCount = computed(() => {
  return completedRuns.value.filter(run => run.status === 'success').length
})

const errorCount = computed(() => {
  return completedRuns.value.filter(run => run.status === 'error').length
})

const successPercentage = computed(() => {
  if (completedRuns.value.length === 0) return 0
  return (successCount.value / completedRuns.value.length) * 100
})

const errorPercentage = computed(() => {
  if (completedRuns.value.length === 0) return 0
  return (errorCount.value / completedRuns.value.length) * 100
})

</script>

<style src="@root/css/agent.css"></style>

<style scoped>

.agent-info {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0.75rem;
}

.stat-card .stat-content .stat-value {
  font-weight: var(--font-weight-semibold);
}

</style>
