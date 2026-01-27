<template>
  <ContextMenuTrigger position="below-right" :bordered="false" class="executions-menu" v-if="executions.length > 0">
    <template #trigger>
      <slot name="trigger" :executions="executions" />
    </template>
    <template #menu>
      <div
        v-for="execution in executions"
        :key="execution.id"
        class="item stop"
        @click="emit('stop', execution.id)"
      >
        <SquareIcon />
        {{ t('agent.help.stopExecutionTime', { time: formatTime(execution.startTime) }) }}
      </div>
    </template>
  </ContextMenuTrigger>
</template>

<script setup lang="ts">

import { onMounted, onBeforeUnmount, PropType, ref } from 'vue'
import { SquareIcon } from 'lucide-vue-next'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import { useTimeAgo } from '@composables/ago'
import { t } from '@services/i18n'
import { Agent } from 'types/agents'

const props = defineProps({
  executions: {
    type: Array as PropType<Array<{ id: string, agent: Agent, startTime: number }>>,
    required: true
  }
})

const emit = defineEmits<{
  stop: [executionId: string]
}>()

const currentTime = ref(Date.now())
let intervalId: NodeJS.Timeout | null = null

onMounted(() => {
  // Update current time every second for relative time display
  intervalId = setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

const formatTime = (startTime: number): string => {
  // Force re-evaluation with currentTime (reactivity)
  currentTime.value

  const now = Date.now()
  const elapsed = now - startTime
  const seconds = Math.floor(elapsed / 1000)

  // For times under 60 seconds, show seconds explicitly
  if (seconds < 60) {
    if (seconds < 2) {
      return t('agent.help.startedJustNow')
    }
    return t('agent.help.startedSecondsAgo', { seconds })
  }

  // For times >= 60 seconds, use the standard time ago formatter
  const timeAgo = useTimeAgo()
  return timeAgo.format(new Date(startTime))
}


</script>

<style scoped>

.executions-menu {
  position: relative;
}

:deep() .button-icon.trigger {
  padding: 0;
}

</style>
