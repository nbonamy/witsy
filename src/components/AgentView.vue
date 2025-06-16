
<template>

  <div class="header">
    <form>
      <div class="group">
        <label>{{ t('agent.description') }}</label>
        {{ agent.description }}
      </div>
      <div class="group">
        <label>{{ t('agent.runCount') }}</label>
        {{ runs.length }}
      </div>
      <div class="group">
        <label>{{ t('agent.lastRun') }}</label>
        {{ lastRun }}
      </div>
      <div class="group" v-if="agent.schedule">
        <label>{{ t('agent.nextRun') }}</label>
        {{ nextRun }}
      </div>
      <div class="group">
        <label>&nbsp;</label>
        <button @click.prevent="onRun">{{ t('agent.run') }}</button>
        <button @click.prevent="onEdit">{{ t('common.edit') }}</button>
        <button @click.prevent="onClearHistory">{{ t('agent.history.clear') }}</button>
        <button @click.prevent="onDelete">{{ t('common.delete') }}</button>
      </div>


    </form>

  </div>

  <AgentHistory :agent="agent" :runs="runs" />

</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, Ref, PropType, onMounted, watch, computed } from 'vue'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import AgentHistory from './AgentHistory.vue'

const runs: Ref<AgentRun[]> = ref([]) 

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
})

const emit = defineEmits(['run', 'edit', 'clearHistory', 'delete'])

const lastRun = computed(() => {
  if (runs.value.length === 0) return t('agent.history.neverRun')
  const lastRun = runs.value[runs.value.length - 1]
  return new Date(lastRun.createdAt).toLocaleString()
})

const nextRun = computed(() => {
  if (!props.agent.schedule) return ''
  const schedule = CronExpressionParser.parse(props.agent.schedule)
  const next = schedule.next().toDate()
  return next.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })
})

onMounted(() => {
  watch(() => props.agent, () => {
    runs.value = window.api.agents.getRuns(props.agent.id)
  }, { immediate: true })
})

const onRun = () => {
  emit('run', props.agent)
}

const onEdit = () => {
  emit('edit', props.agent)
}

const onClearHistory = () => {
  window.api.agents.deleteRuns(props.agent.id)
}

const onDelete = () => {
  emit('delete', props.agent)
}


</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.header {

  background-color: var(--dialog-body-bg-color);
  border-top: 1px solid var(--control-border-color);
  border-bottom: 1px solid var(--control-border-color);
  min-height: 100px;
  padding: 2rem;

  .group {
    align-items: flex-start;
    font-size: 10.5pt;

    label {
      min-width: 120px;
      margin-right: 16px;
      font-weight: bold;
      text-align: right;
    }

    label::after {
      content: none !important;
    }

  }

}


</style>
