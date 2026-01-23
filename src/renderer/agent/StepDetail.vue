
<template>

  <template v-if="stepMessages">

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
        <div class="stat-icon"><WrenchIcon /></div>
        <div class="stat-content">
          <div class="stat-value">{{ toolCallsCount }}</div>
          <div class="stat-label">{{ t('agent.step.toolCalls') }}</div>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div class="step-messages">
      <div class="messages" :class="[ 'openai', 'size' + store.config.appearance.chat.fontSize ]" ref="divScroller">
        <MessageItem :chat="chat" :message="chat.messages[0]" :author-name="stepPrompt" class="message" />
        <MessageItem :chat="chat" :message="chat.messages[1]" :author-name="agentName" class="message" v-if="chat.messages.length > 1"/>
      </div>

      <!-- Running state -->
      <div class="message-section running" v-if="!stepMessages.response">
        <Loader />
        <span>{{ t('agent.run.stepRunning') }}</span>
      </div>
    </div>

  </template>

</template>

<script setup lang="ts">

import Chat from '@/models/chat'
import Loader from '@components/Loader.vue'
import AgentRunModel from '@models/agent_run'
import Message from '@models/message'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { TimerIcon, WrenchIcon } from 'lucide-vue-next'
import { Agent, AgentRun } from 'types/agents'
import { PropType, computed, ref, watchEffect, onMounted, onUnmounted } from 'vue'
import MessageItem from '../components/MessageItem.vue'

type StepMessages = {
  prompt: Message | null
  response: Message | null
}

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  run: {
    type: Object as PropType<AgentRun>,
    required: true,
  },
  stepIndex: {
    type: Number,
    required: true,
  },
})


const chat = computed(() => {

  const messages = stepMessages.value
  if (!messages) return null

  const chat = new Chat()
  chat.addMessage(messages.prompt)
  if (messages.response) {
    chat.addMessage(messages.response)
    chat.messages[1].agentId = props.agent.uuid
  }
  
  return chat

})

const agentName = computed(() => {
  return props.run.agentInfo?.name || props.agent.name
})

const stepPrompt = computed<string>(() => {
  if (props.stepIndex === 0) return null
  return props.run.agentInfo?.steps?.[props.stepIndex - 1]?.description || t('agent.run.outputItem', { index: props.stepIndex } )
})

const stepMessages = computed<StepMessages | null>(() => {
  if (props.stepIndex === 0) return null

  const runModel = AgentRunModel.fromJson(props.run)
  const messages = runModel.messages || []

  // Skip system message, then pair user/assistant messages
  // stepIndex 1 corresponds to messages[1] (user) and messages[2] (assistant)
  const promptIndex = props.stepIndex * 2 - 1
  const responseIndex = promptIndex + 1

  if (promptIndex >= messages.length) return null

  return {
    prompt: messages[promptIndex] || null,
    response: messages[responseIndex] || null,
  }
})

// Timer for live duration updates when step is running
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const startTimer = () => {
  if (timerInterval) return
  now.value = Date.now()
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

// Check if current step is running (no response content yet while run is active)
const isStepRunning = computed(() => {
  const response = stepMessages.value?.response
  const hasContent = response?.content && response.content.length > 0
  return props.run?.status === 'running' && stepMessages.value && !hasContent
})

onMounted(() => {
  watchEffect(() => {
    if (isStepRunning.value) {
      startTimer()
    } else {
      stopTimer()
    }
  })
})

onUnmounted(() => {
  stopTimer()
})

// Get next step's prompt message (for duration calculation)
const nextStepPrompt = computed<Message | null>(() => {
  const runModel = AgentRunModel.fromJson(props.run)
  const messages = runModel.messages || []

  // Next step's prompt index
  const nextPromptIndex = (props.stepIndex + 1) * 2 - 1

  if (nextPromptIndex < messages.length) {
    return messages[nextPromptIndex]
  }
  return null
})

// Calculate step duration
const duration = computed(() => {
  const messages = stepMessages.value
  if (!messages?.prompt?.createdAt) return null

  const start = messages.prompt.createdAt

  // Determine end time
  let end: number
  if (isStepRunning.value) {
    // Step is still running - use current time
    end = now.value
  } else if (nextStepPrompt.value?.createdAt) {
    // There's a next step - use its prompt createdAt
    end = nextStepPrompt.value.createdAt
  } else {
    // Last step - use run updatedAt
    end = props.run.updatedAt
  }

  const durationMs = Math.max(0, end - start)
  return durationMs < 1000 ? `${durationMs} ms` : `${Math.round(durationMs / 1000)} s`
})

// Count tool calls in response
const toolCallsCount = computed(() => {
  const response = stepMessages.value?.response
  return response?.toolCalls?.length || 0
})

</script>

<style src="@root/css/agent.css"></style>

<style scoped>

.stats-grid {
  margin-bottom: 1rem;
}

.step-messages {
  flex: 1;
  overflow: auto;
  &:deep() .messages {
    padding: 0rem;

    .message .actions {
      .quote, .delete, .retry, .edit, .fork, .scratchpad { display: none; }
    }
  }
}

</style>
