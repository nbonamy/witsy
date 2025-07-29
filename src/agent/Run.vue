
<template>

  <div class="run panel" v-if="run">

    <div class="panel-header">
      <label>{{ t('agent.run.title') }}</label>
      <BIconCalendar2X class="icon delete" @click="$emit('delete')" />
    </div>

    <div class="panel-body form form-vertical form-large">
      <div class="form-field">
        <label>{{ t('agent.run.id') }}</label>
        {{ run.id }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.trigger') }}</label>
        {{ run.trigger }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.status') }}</label>
        {{ run.status }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.createdAt') }}</label>
        {{ formatDate(run.createdAt) }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.updatedAt') }}</label>
        {{ formatDate(run.updatedAt) }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.duration') }}</label>
        {{ duration ? `${duration} ms` : t('agent.run.notCompleted') }}
      </div>
      <div class="form-field">
        <label>{{ t('agent.run.prompt') }}</label>
        <textarea class="prompt" :value="run.prompt" readonly></textarea>
      </div>
      <div class="form-field" v-if="run.error">
        <label>{{ t('agent.run.error') }}</label>
        <div class="error-text">{{ run.error }}</div>
      </div>
      <div class="form-field message" v-if="run.messages.length === 3">
        <label>{{ t('agent.run.output') }}</label>
        <div class="output">
          <MessageItemBody :message="run.messages[run.messages.length - 1] as Message" show-tool-calls="always" />
        </div>
      </div>
      
    </div>

  </div>

</template>

<script setup lang="ts">

import { AgentRun, Message } from '../types/index'
import { computed, PropType } from 'vue'
import { t } from '../services/i18n'
import MessageItemBody from '../components/MessageItemBody.vue'
import { BIconCalendar2X } from 'bootstrap-icons-vue'

const props = defineProps({
  run: {
    type: Object as PropType<AgentRun>,
    required: true
  }
})

const formatDate = (date: number) => {
  return new Date(date).toString().split(' ').slice(0, 5).join(' ')
}

const duration = computed(() => {
  if (!props.run || !props.run.createdAt || !props.run.updatedAt) return null
  const start = new Date(props.run.createdAt).getTime()
  const end = new Date(props.run.updatedAt).getTime()
  return end - start
})

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

    margin-top: 0.5rem;
    width: 100%;
  
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