
<template>

  <div class="run" v-if="run">

    <!-- Metadata Panel -->
    <div class="panel metadata-panel">
      <div class="panel-header" @click="togglePanel">
        <label>{{ t('agent.run.metadata') }}</label>
        <div class="actions">
          <ButtonIcon
            class="delete"
            v-tooltip="{ text: t('agent.help.deleteRun'), position: 'bottom-left' }"
            @click="(event) => { event?.stopPropagation(); $emit('delete') }"
          ><CalendarMinus2Icon /></ButtonIcon>
          <div class="icon"><ChevronDownIcon /></div>
        </div>
      </div>
      <div class="panel-body form form-vertical form-large">
        <div class="form-field">
          <label>{{ t('agent.run.id') }}</label>
          {{ run.uuid }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.trigger') }}</label>
          {{ t(`agent.trigger.${run.trigger}`) }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.status') }}</label>
          {{ t(`agent.status.${run.status}`) }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.createdAt') }}</label>
          {{ formatDate(run.createdAt) }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.updatedAt') }}</label>
          {{ run.status === 'running' ? t('agent.run.notCompleted') : formatDate(run.updatedAt) }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.duration') }}</label>
          {{ duration || t('agent.run.notCompleted') }}
        </div>
        <div class="form-field">
          <label>{{ t('agent.run.prompt') }}</label>
          <textarea class="prompt" :value="run.prompt" readonly></textarea>
        </div>
        <div class="form-field" v-if="run.error">
          <label>{{ t('agent.run.error') }}</label>
          <div class="error-text">{{ run.error }}</div>
        </div>
      </div>
    </div>

    <!-- Output Panels -->
    <template v-if="outputs && outputs.length > 0">
      <div v-for="(messages, index) in outputs" :key="index" class="panel output-panel" :class="{ collapsed: !expandedPanels.has(index) }">
        <div class="panel-header" @click="toggleOutputPanel(index)">
          <label>{{ getOutputTitle(index) }}</label>
          <div class="icon"><ChevronDownIcon /></div>
        </div>
        <div class="panel-body" v-if="expandedPanels.has(index)">
          <hr/>
          <div class="step-prompt">
            <div class="prompt-toggle" @click="togglePrompt(index)">
              <ChevronRightIcon :class="{ expanded: expandedPrompts.has(index) }" />
              <span>{{ expandedPrompts.has(index) ? t('agent.run.hidePrompt') : t('agent.run.showPrompt') }}</span>
            </div>
            <MessageItemBody class="item-prompt" :message="messages.prompt" v-if="expandedPrompts.has(index)" show-tool-calls="always"/>
          </div>
          <hr/>
          <MessageItemBody :message="messages.response" show-tool-calls="always"/>
        </div>
      </div>
    </template>
    <div v-else class="no-outputs">
      {{ t('agent.run.noOutputs') }}
    </div>

  </div>

</template>

<script setup lang="ts">

import { CalendarMinus2Icon, ChevronDownIcon, ChevronRightIcon } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import MessageItemBody from '../components/MessageItemBody.vue'
import { togglePanel } from '../composables/panel'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { AgentRun } from '../types/agents'
import Message from '../models/message'

type StepMessages = {
  prompt: Message
  response: Message | null
}

const props = defineProps({
  agentId: {
    type: String,
    required: true
  },
  runId: {
    type: String,
    required: true
  }
})

const run = ref<AgentRun | null>(null)
const agent = ref<any | null>(null)
const expandedPanels = ref<Set<number>>(new Set())
const expandedPrompts = ref<Set<number>>(new Set())

let refreshTimeout: NodeJS.Timeout

const duration = computed(() => {
  if (!run.value || !run.value.createdAt || !run.value.updatedAt) return null
  const start = new Date(run.value.createdAt).getTime()
  const end = run.value.status === 'running' ? Date.now() : new Date(run.value.updatedAt).getTime()
  const durationMs = end - start
  return durationMs < 1000 ? `${durationMs} ms` : `${Math.round(durationMs / 1000)} s`
})

const outputs = computed(() => {
  if (!run.value || !run.value.messages || run.value.messages.length < 3) return null
  return run.value.messages.slice(1).reduce((acc: StepMessages[], msg: Message) => {
    if (msg.role === 'user') acc.push({ prompt: msg, response: null })
    if (msg.role === 'assistant') {
      if (acc.length === 0 || acc[acc.length-1].response) {
        acc.push({ prompt: null, response: msg })
      } else {
        acc[acc.length-1].response = msg
      }
    }
    return acc
  }, [] as StepMessages[])
})

onMounted(() => {
  loadAgentRun()
  watch(() => props || {}, async () => {
    clearTimeout(refreshTimeout)
    loadAgentRun()
  }, { deep: true, immediate: true })
})

const loadAgentRun = async () => {
  try {
    clearTimeout(refreshTimeout)
    run.value = window.api.agents.getRun(store.config.workspaceId, props.agentId, props.runId)

    // Load agent definition to get step descriptions
    if (!agent.value) {
      const agents = window.api.agents.load(store.config.workspaceId)
      agent.value = agents.find(a => a.uuid === props.agentId)
    }

    if (run.value.status === 'running') {
      setTimeout(() => {
        loadAgentRun()
      }, 1000)
    }
  } catch (error) {
    console.error('Failed to load agent run:', error)
  }
}

const formatDate = (date: number) => {
  return new Date(date).toString().split(' ').slice(0, 5).join(' ')
}

const getOutputTitle = (index: number) => {
  const num = index + 1
  const stepDescription = agent.value?.steps?.[index]?.description || ''
  return stepDescription ? `${t('agent.run.outputItem', { index: num })} - ${stepDescription}` : t('agent.run.outputItem', { index: num })
}

const toggleOutputPanel = (index: number) => {
  if (expandedPanels.value.has(index)) {
    expandedPanels.value.delete(index)
  } else {
    expandedPanels.value.add(index)
  }
}

const togglePrompt = (index: number) => {
  if (expandedPrompts.value.has(index)) {
    expandedPrompts.value.delete(index)
  } else {
    expandedPrompts.value.add(index)
  }
}

const emit = defineEmits(['delete'])

</script>

<style scoped>

.run {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1rem;
  overflow: auto;
}

.metadata-panel {
  flex-shrink: 0;

  .panel-header {
    label {
      cursor: pointer;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }
}

.output-panel {
  flex-shrink: 0;

  .panel-header label {
    cursor: pointer;
  }

  &.collapsed .panel-body {
    display: none;
  }

  .panel-body {

    &:deep() {
      .text {
        margin: 0;
        padding: 0;
        font-size: var(--agent-font-size);
        text-align: left;
      }
    }

    hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 0.5rem 0;
    }

    .prompt-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
      color: var(--faded-text-color);
      font-size: 0.9rem;

      &:hover {
        color: var(--text-color);
      }

      svg {
        width: 16px;
        height: 16px;
        transition: transform 0.2s ease;

        &.expanded {
          transform: rotate(90deg);
        }
      }
    }

  }
}

.no-outputs {
  padding: 2rem;
  text-align: center;
  font-size: 16px;
  font-weight: 300;
  color: var(--faded-text-color);
}

.prompt {
  min-height: 5lh;
  resize: vertical;
}

.error-text {
  color: var(--text-error);
  padding: 0.5rem;
  background-color: var(--bg-error);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
}

</style>