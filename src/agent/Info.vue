
<template>

  <div class="header panel">
  
    <div class="panel-header">
      <label>{{ t('agent.view.header') }}</label>
      <BIconPlayCircle v-if="agent.type === 'runnable'" class="icon run" @click="onRun" />
      <BIconPencil class="icon edit" @click="onEdit" />
      <BIconTrash class="icon delete" @click="onDelete" />
    </div>
    
    <div class="panel-body form form-vertical form-large">
      <div class="form-field">
        <label>{{ t('agent.description') }}</label>
        {{ agent.description }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.runCount') }}</label>
        {{ runs.length }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.lastRun') }}</label>
        {{ lastRun }}
      </div>
      <div class="form-field" v-if="agent.schedule">
        <label>{{ t('agent.nextRun') }}</label>
        {{ nextRun }}
      </div>
    </div>

  </div>


</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, PropType, computed } from 'vue'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import { useTimeAgo } from '../composables/ago'

const runs = ref<AgentRun[]>([])

const timeAgo = useTimeAgo()

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

const lastRun = computed(() => {
  if (runs.value.length === 0) return t('agent.history.neverRun')
  const lastRun = runs.value[runs.value.length - 1]
  return timeAgo.format(new Date(lastRun.createdAt))
})

const nextRun = computed(() => {
  if (!props.agent.schedule) return ''
  const schedule = CronExpressionParser.parse(props.agent.schedule)
  const next = schedule.next().toDate()
  return next.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })
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
