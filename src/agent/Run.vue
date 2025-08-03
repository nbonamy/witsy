
<template>

  <div class="run panel" v-if="run">

    <div class="panel-header">
      <label>{{ t('agent.run.title') }}</label>
      <BIconCalendar2X 
        class="icon delete" 
        v-tooltip="{ text: t('agent.help.deleteRun'), position: 'bottom-left' }" 
        @click="$emit('delete')" 
      />
    </div>

    <div class="panel-body form form-vertical form-large">
      <div class="form-field">
        <label>{{ t('agent.run.id') }}</label>
        {{ run.id }}
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
      <div class="form-field message">
        <label>{{ t('agent.run.output') }}</label>
        <div class="output" v-for="response in outputs" v-if="outputs">
          <MessageItemBody :message="response" show-tool-calls="always"/>
        </div>
        <span v-else>{{ t('agent.run.notCompleted') }}</span>
      </div>
    </div>

  </div>

</template>

<script setup lang="ts">

import { AgentRun } from '../types/index'
import { computed, ref, onMounted, watch } from 'vue'
import { t } from '../services/i18n'
import MessageItemBody from '../components/MessageItemBody.vue'
import { BIconCalendar2X } from 'bootstrap-icons-vue'

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
  return run.value.messages.slice(2)
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
    run.value = window.api.agents.getRun(props.agentId, props.runId)
    if (run.value.status === 'running') {
      setTimeout(() => {
        loadAgentRun()
      }, 2500)
    }
  } catch (error) {
    console.error('Failed to load agent run:', error)
  }
}

const formatDate = (date: number) => {
  return new Date(date).toString().split(' ').slice(0, 5).join(' ')
}

const emit = defineEmits(['delete'])

</script>

<style scoped>

.run {
  width: 100%;
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

.message {

  .output {

    border-bottom: 1px solid var(--text-color);
    padding-bottom: 0.75rem;
    margin-top: 0.5rem;
    width: 100%;
    
    &:last-child {
      border-bottom: none;
    }
  
    &:deep() {
      .text {
        margin: 0;
        padding: 0;
        font-size: var(--agent-font-size);
        text-align: left;
      }
    }
  }
}


</style>