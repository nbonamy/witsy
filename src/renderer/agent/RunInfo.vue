
<template>

  <div class="run-overview">

    <!-- Status Hero -->
    <div class="status-hero" :class="run.status">
      <div class="status-icon">
        <StatusIcon :status="run.status" />
      </div>
      <div class="status-info">
        <div class="status-label">{{ t(`agent.status.${run.status}`) }}</div>
        <div class="status-time">{{ timeAgo.format(new Date(run.createdAt)) }}</div>
      </div>
    </div>

    <!-- Engine/Model Card -->
    <div class="model-card" v-if="runEngine && runModelId">
      <div class="model-icon">
        <EngineLogo :engine="runEngine" />
      </div>
      <div class="model-info">
        <div class="model-name">{{ runModelName }}</div>
        <div class="model-engine">{{ runEngineName }}</div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon"><TimerIcon /></div>
        <div class="stat-content">
          <div class="stat-value">{{ duration || '—' }}</div>
          <div class="stat-label">{{ t('agent.run.duration') }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><TriggerIcon :trigger="run.trigger" /></div>
        <div class="stat-content">
          <div class="stat-value">{{ t(`agent.trigger.${run.trigger}`) }}</div>
          <div class="stat-label">{{ t('agent.run.trigger') }}</div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="timeline">
      <!-- Start -->
      <div class="timeline-item">
        <div class="timeline-dot start"></div>
        <div class="timeline-content">
          <div class="timeline-label">{{ t('agent.run.createdAt') }}</div>
          <div class="timeline-value">{{ formatDateTime(run.createdAt) }}</div>
        </div>
      </div>
      <!-- Steps -->
      <div class="timeline-item" v-for="(step, index) in timelineSteps" :key="index">
        <div class="timeline-dot step" :class="step.status"></div>
        <div class="timeline-content">
          <div class="timeline-label">{{ step.description || `Step ${index + 1}` }}</div>
          <div class="timeline-value">{{ formatTimelinestamp(step.timestamp, index) }}</div>
        </div>
      </div>
      <!-- End -->
      <div class="timeline-item" v-if="run.status !== 'running'">
        <div class="timeline-dot end" :class="run.status"></div>
        <div class="timeline-content">
          <div class="timeline-label">{{ t('agent.run.updatedAt') }}</div>
          <div class="timeline-value">{{ formatTimeOnly(run.updatedAt) }}</div>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="run.error" class="error-alert">
      <div class="error-header">
        <AlertTriangleIcon />
        <span>{{ t('agent.run.error') }}</span>
      </div>
      <div class="error-message">{{ run.error }}</div>
    </div>

    <!-- Last Step Output (for successful runs) -->
    <div v-if="run.status === 'success' && lastStepOutput" class="output-section">
      <div class="output-header">
        <CheckCircle2Icon />
        <span>{{ t('agent.run.output') }}</span>
      </div>
      <div class="output-content messages openai" :class="'size' + store.config.appearance.chat.fontSize">
        <div class="message assistant">
          <div class="body">
            <MessageItemBody :message="lastStepOutput" show-tool-calls="never" />
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Info -->
    <div v-if="isDebug" class="debug-info">
      <code>{{ run.uuid }}</code>
    </div>

  </div>

</template>

<script setup lang="ts">

import AgentRunModel from '@models/agent_run'
import { useTimeAgo } from '@composables/ago'
import { store } from '@services/store'
import { t } from '@services/i18n'
import { AlertTriangleIcon, CheckCircle2Icon, TimerIcon } from 'lucide-vue-next'
import { Agent, AgentRun } from 'types/agents'
import EngineLogo from '@components/EngineLogo.vue'
import LlmFactory from '@services/llms/llm'
import { engineNames } from '@services/llms/consts'
import { PropType, computed, ref, watch, onUnmounted } from 'vue'
import MessageItemBody from '../components/MessageItemBody.vue'
import StatusIcon from './StatusIcon.vue'
import TriggerIcon from './TriggerIcon.vue'

const timeAgo = useTimeAgo()

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  run: {
    type: Object as PropType<AgentRun>,
    required: true,
  }
})

defineEmits(['delete'])

const isDebug = computed(() => {
  return window.api.debug.isDebug
})

// Get engine/model from second message (first assistant response)
const runEngine = computed(() => {
  const runModelObj = AgentRunModel.fromJson(props.run)
  const messages = runModelObj.messages || []
  return messages[1]?.engine || null
})

const runModelId = computed(() => {
  const runModelObj = AgentRunModel.fromJson(props.run)
  const messages = runModelObj.messages || []
  return messages[1]?.model || null
})

const runModelName = computed(() => {
  if (!runEngine.value || !runModelId.value) return null
  const llmManager = LlmFactory.manager(store.config)
  const chatModel = llmManager.getChatModel(runEngine.value, runModelId.value)
  return chatModel?.name || runModelId.value
})

const runEngineName = computed(() => {
  if (!runEngine.value) return null
  return engineNames[runEngine.value] || runEngine.value
})

// Timer for live duration updates
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const startTimer = () => {
  if (timerInterval) return
  timerInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// Watch for status changes to start/stop timer
watch(() => props.run?.status, (status) => {
  if (status === 'running') {
    startTimer()
  } else {
    stopTimer()
  }
}, { immediate: true })

onUnmounted(() => {
  stopTimer()
})

const duration = computed(() => {
  if (!props.run || !props.run.createdAt) return null
  const start = new Date(props.run.createdAt).getTime()
  const end = props.run.status === 'running' ? now.value : new Date(props.run.updatedAt).getTime()
  const durationMs = end - start
  return durationMs < 1000 ? `${durationMs} ms` : `${Math.round(durationMs / 1000)} s`
})

const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatTimeOnly = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isSameDate = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

const formatTimelinestamp = (timestamp: number, stepIndex: number) => {
  if (!timestamp) return '—'

  // Compare with previous step or run start
  const prevTimestamp = stepIndex === 0
    ? props.run.createdAt
    : timelineSteps.value[stepIndex - 1]?.timestamp || props.run.createdAt

  if (isSameDate(timestamp, prevTimestamp)) {
    return formatTimeOnly(timestamp)
  }
  return formatDateTime(timestamp)
}

// Get steps for timeline
const timelineSteps = computed(() => {
  const runModel = AgentRunModel.fromJson(props.run)
  const messages = runModel.messages || []
  const steps: Array<{ description: string; status: string; timestamp: number }> = []

  // Skip system message, then pair user/assistant messages as steps
  let stepIndex = 1
  for (let i = 1; i < messages.length; i += 2) {
    const promptMsg = messages[i]
    const responseMsg = messages[i + 1]
    const isLastStep = i + 2 >= messages.length
    const stepInfo = props.agent.steps?.[stepIndex - 1]
    const runStepInfo = props.run.agentInfo?.steps?.[stepIndex - 1]

    const stepIsRunning = props.run.status === 'running' && isLastStep && !responseMsg
    const status = stepIsRunning ? 'running' : (responseMsg ? 'success' : 'pending')

    steps.push({
      description: runStepInfo?.description || stepInfo?.description || '',
      status,
      timestamp: promptMsg?.createdAt || 0,
    })
    stepIndex++
  }

  return steps
})

// Get the last step output for successful runs
const lastStepOutput = computed(() => {
  if (props.run.status !== 'success') return null

  const runModel = AgentRunModel.fromJson(props.run)
  const messages = runModel.messages || []

  // Find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i]
    }
  }
  return null
})

</script>

<style src="@root/css/agent.css"></style>

<style scoped>

.run-overview {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.status-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);

  .status-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    &:deep() svg {
      width: 28px !important;
      height: 28px !important;
    }
  }

  .status-info {
    flex: 1;

    .status-label {
      font-size: 18px;
      font-weight: var(--font-weight-semibold);
    }

    .status-time {
      font-size: 13px;
      color: var(--faded-text-color);
      margin-top: 2px;
    }
  }

}

.model-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--sidebar-bg-color);

  .model-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;

    &:deep() .logo {
      width: 32px;
      height: 32px;
    }
  }

  .model-info {
    flex: 1;
    min-width: 0;

    .model-name {
      font-size: 14px;
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .model-engine {
      font-size: 12px;
      color: var(--faded-text-color);
      margin-top: 2px;
    }
  }
}

.stat-card {
  gap: 1rem;
  padding: 1rem 1.5rem;

  .stat-icon {
    width: var(--icon-xl);
    height: var(--icon-xl);
    svg {
      width: var(--icon-xl);
      height: var(--icon-xl);
    }
  }
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 0.5rem;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  position: relative;
  padding-bottom: 1rem;

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 20px;
    bottom: 0;
    width: 2px;
    background-color: var(--border-color);
  }

  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--border-color);
    flex-shrink: 0;
    margin-top: 4px;

    &.start {
      background-color: var(--highlight-color);
    }

    &.step {
      background-color: var(--border-color);
      &.success { background-color: var(--color-success); }
      &.running { background-color: var(--color-warning); }
      &.pending { background-color: var(--border-color); }
    }

    &.end {
      &.success { background-color: var(--color-success); }
      &.error { background-color: var(--color-error); }
      &.canceled { background-color: var(--color-warning); }
    }
  }

  .timeline-content {
    flex: 1;
    min-width: 0;

    .timeline-label {
      font-size: 13px;
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .timeline-value {
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      color: var(--faded-text-color);
      margin-top: 2px;
    }
  }
}

.error-alert {
  border-radius: var(--radius-sm);
  background-color: var(--color-error-container);
  border: 1px solid var(--color-error);
  overflow: hidden;

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--color-error);
    color: white;
    font-weight: var(--font-weight-medium);
    font-size: 13px;

    svg {
      width: 16px;
      height: 16px;
    }
  }

  .error-message {
    padding: 0.75rem 1rem;
    font-family: monospace;
    font-size: 12px;
    color: var(--color-error);
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.output-section {
  border-radius: var(--radius-sm);
  background-color: var(--sidebar-bg-color);
  border: 1px solid var(--border-color);
  overflow: hidden;

  .output-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-weight: var(--font-weight-medium);
    font-size: 13px;
    color: var(--faded-text-color);

    svg {
      width: 16px;
      height: 16px;
      color: var(--color-success);
    }
  }

  .output-content {
    padding: 0.75rem 1rem;
    &:deep() .message {
      margin: 0;
      .body {
        margin: 0;
        padding: 0 1rem;
      }
    }
  }
}

</style>
