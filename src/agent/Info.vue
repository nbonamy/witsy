
<template>

  <div class="agent-info panel">
  
    <div class="panel-header">
      <label>{{ t('agent.view.header') }}</label>
      <ButtonIcon 
        class="run" 
        v-tooltip="{ text: t('agent.help.run'), position: 'bottom-left' }" 
        @click="onRun" 
      ><PlayIcon /></ButtonIcon>
      <ButtonIcon 
        class="edit" 
        v-tooltip="{ text: t('agent.help.edit'), position: 'bottom-left' }" 
        @click="onEdit" 
      ><PencilIcon /></ButtonIcon>
      <ButtonIcon 
        class="delete" 
        v-tooltip="{ text: t('agent.help.delete'), position: 'bottom-left' }" 
        @click="onDelete" 
      ><Trash2Icon /></ButtonIcon>
    </div>
    
    <div class="panel-body form form-vertical form-large">
      <div class="form-field">
        <label>{{ t('agent.description') }}</label>
        {{ agent.description }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.status') }}</label>
        <div class="status-bar" v-if="completedRuns.length > 0">
          <div class="status-bar-segment success" :style="{ width: successPercentage + '%' }">
            {{ successPercentage ? `${successPercentage.toFixed(0)}%` : '' }}
          </div>
          <div class="status-bar-segment error" :style="{ width: errorPercentage + '%' }">
            {{ errorPercentage ? `${errorPercentage.toFixed(0)}%` : '' }}
          </div>
        </div>
        <div class="status-text" v-else>{{ t('agent.history.neverRun') }}</div>
      </div>
      <div class="form-field" v-if="agent.schedule">
        <label>{{ t('agent.nextRun') }}</label>
        {{ nextRun }}
      </div>
    </div>

  </div>

</template>
<script setup lang="ts">

import { CronExpressionParser } from 'cron-parser'
import { PencilIcon, PlayIcon, Trash2Icon } from 'lucide-vue-next'
import { PropType, computed } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import { t } from '../services/i18n'
import { Agent, AgentRun } from '../types/agents'

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

const emit = defineEmits(['run', 'edit', 'delete'])

// const lastRun = computed(() => {
//   if (runs.value.length === 0) return t('agent.history.neverRun')
//   const lastRun = runs.value[runs.value.length - 1]
//   return timeAgo.format(new Date(lastRun.createdAt))
// })

const nextRun = computed(() => {
  if (!props.agent.schedule) return ''
  const schedule = CronExpressionParser.parse(props.agent.schedule)
  const next = schedule.next().toDate()
  return next.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })
})

const completedRuns = computed(() => {
  return props.runs.filter(run => run.status !== 'running')
})

const successPercentage = computed(() => {
  if (completedRuns.value.length === 0) return 0
  const successCount = completedRuns.value.filter(run => run.status === 'success').length
  return (successCount / completedRuns.value.length) * 100
})

const errorPercentage = computed(() => {
  if (completedRuns.value.length === 0) return 0
  const errorCount = completedRuns.value.filter(run => run.status === 'error').length
  return (errorCount / completedRuns.value.length) * 100
})

const onRun = () => {
  emit('run', props.agent)
}

const onEdit = () => {
  emit('edit', props.agent)
}

const onDelete = () => {
  emit('delete', props.agent)
}

</script>

<style scoped>

.status-bar {
  margin-top: 0.5rem;
  display: flex;
  height: 1.25rem;
  border-radius: 0.5rem;
  background-color: var(--color-border);
  overflow: hidden;
  width: 100%;
}

.status-bar-segment {
  height: 100%;
  padding-top: 2px;
  text-align: center;
  font-weight: bold;
  font-size: 13.5px;
}

.status-bar-segment.success {
  background-color: #10b981;
  color: white;
}

.status-bar-segment.error {
  background-color: #ef4444;
  color: white;
}

.status-text {
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: 4px;
}
</style>
