<template>
  <ContextMenuTrigger position="below-right" class="executions-menu">
    <template #trigger>
      <ButtonIcon
        v-if="variant === 'icon'"
        class="stop"
        v-tooltip="{ text: stopTooltip, position: 'top-left' }"
      >
        <SquareIcon />
        <span v-if="executions.length > 1" class="badge">{{ executions.length }}</span>
      </ButtonIcon>
      <button
        v-else
        type="button"
        class="secondary stop-button"
        v-tooltip="{ text: stopTooltip, position: 'top-left' }"
      >
        <SquareIcon />
        {{ executions.length > 1 ? t('agent.help.stopMultiple', { count: executions.length }) : t('common.stop') }}
      </button>
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

import { computed, onMounted, onUnmounted, PropType, ref } from 'vue'
import { SquareIcon } from 'lucide-vue-next'
import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import { useTimeAgo } from '@composables/ago'
import { t } from '@services/i18n'
import { Agent } from 'types/agents'

const props = defineProps({
  executions: {
    type: Array as PropType<Array<{ id: string, agent: Agent, startTime: number }>>,
    required: true
  },
  variant: {
    type: String as PropType<'icon' | 'button'>,
    default: 'icon'
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

onUnmounted(() => {
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

const stopTooltip = computed(() => {
  if (props.executions.length === 1) {
    return t('agent.help.stop')
  }
  return t('agent.help.stopMultiple', { count: props.executions.length })
})

</script>

<style scoped>

.executions-menu {
  position: relative;
}

:deep(.button-icon) {
  position: relative;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: var(--color-error);
  color: var(--color-on-error);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  padding: 2px 4px;
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
  line-height: 1;
}

button.stop-button {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  color: var(--color-error);
}

button.stop-button:hover {
  background-color: var(--color-error-container);
}

</style>
