<template>
  <WizardStep :visible="visible" :next-button-text="nextButtonText" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.invocation.title') }}</label>
    </template>
    <template #content>
      <div class="form-field">
        <label for="manual">{{ t('agent.trigger.manual') }}</label>
        {{  t('agent.trigger.manual_description') }}
      </div>

      <div class="form-field">
        <label for="schedule">{{ t('agent.trigger.schedule') }}</label>
        <Scheduler v-model="agent.schedule" />
      </div>

      <div class="form-field" v-if="nextRuns">
        <label for="next">{{ t('agent.trigger.nextRuns') }}</label>
        <span v-html="nextRuns"></span>
      </div>

      <div class="form-field">
        <label>{{ t('agent.trigger.webhook') }}</label>
      </div>

      <div class="form-field horizontal">
        <input type="checkbox" v-model="webhookEnabled" @change="onWebhookToggle" />
        <span>{{ t('agent.trigger.webhook_description') }}</span>
      </div>

      <div class="form-field" v-if="webhookEnabled">
        <label>{{ t('agent.trigger.webhook_url') }}</label>
        <div class="webhook-url-container">
          <input type="text" :value="webhookUrl" readonly />
          <button type="button" @click="onRegenerateToken" :title="t('agent.trigger.webhook_regenerate')">
            <RefreshCwIcon :size="16" />
          </button>
          <button type="button" @click="onCopyUrl" :title="t('agent.trigger.webhook_copy')">
            <CopyIcon :size="16" />
          </button>
        </div>
      </div>

      <template v-if="agent.schedule && promptInputs(0).length">

        <div class="form-field">
          <label for="prompt">{{ t('agent.create.invocation.variables') }}</label>
          <table class="table-plain variables">
            <thead>
              <tr>
                <th>{{ t('common.name') }}</th>
                <th>{{ t('common.value') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="input in promptInputs(0)" :key="input.name">
                <td>{{ input.name }}</td>
                <td><input type="text" v-model="invocationInputs[input.name]" :placeholder="input.defaultValue" @input="saveInvocationInputs"/></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="form-field">
          <label for="prompt">{{ t('agent.create.invocation.prompt') }}</label>
          <textarea v-model="invocationPrompt" readonly></textarea>
        </div>
      
      </template>

    </template>
  </WizardStep>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, PropType } from 'vue'
import { RefreshCwIcon, CopyIcon } from 'lucide-vue-next'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import { extractPromptInputs } from '../services/prompt'
import { store } from '../services/store'
import WizardStep from '../components/WizardStep.vue'
import Scheduler from '../components/Scheduler.vue'
import Agent from '../models/agent'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  nextButtonText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['prev', 'next'])

const invocationInputs = ref<Record<string, string>>({})
const httpPort = ref<number>(8090)

const webhookEnabled = computed({
  get: () => !!props.agent.webhookToken,
  set: async (value: boolean) => {
    if (value) {
      const token = await window.api.agents.generateWebhookToken(
        store.config.workspaceId,
        props.agent.uuid
      )
      props.agent.webhookToken = token
    } else {
      props.agent.webhookToken = null
    }
  }
})

const webhookUrl = computed(() => {
  if (!props.agent.webhookToken) return ''
  return `http://localhost:${httpPort.value}/agent/run/${props.agent.webhookToken}`
})

const nextRuns = computed(() => {
  if (!props.agent.schedule) return ''
  try {
    const interval = CronExpressionParser.parse(props.agent.schedule)
    return interval.take(3).map((date) => date.toDate().toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })).join('<br>')
  } catch (e) {
    return ''
  }
})

const invocationPrompt = computed(() => {
  const values = {...props.agent.invocationValues }
  const inputs = extractPromptInputs(props.agent.steps[0].prompt)
  inputs.forEach(input => {
    if (!values[input.name]?.length) {
      values[input.name] = t('agent.create.invocation.missingInput', { name: input.name })
    }
  })
  return props.agent.buildPrompt(0, values)
})

const promptInputs = (step: number) => {
  return extractPromptInputs(props.agent.steps[step].prompt).map((input) => {
    if (input.name.startsWith('output.')) {
      input.description = t('agent.create.workflow.help.outputVarDesc', { step: input.name.split('.')[1] })
    }
    return input
  })
}

// prepare inputs for the invocation screen
const prepareAgentInvocationInputs = () => {
  invocationInputs.value = {}
  const inputs = extractPromptInputs(props.agent.steps[0].prompt)
  inputs.forEach(input => {
    invocationInputs.value[input.name] = props.agent.invocationValues[input.name] || input.defaultValue|| ''
  })
}

const saveInvocationInputs = () => {
  props.agent.invocationValues = { ...invocationInputs.value }
}

const onNext = () => {
  emit('next')
}

const onWebhookToggle = async () => {
  // webhookEnabled computed setter handles this
}

const onRegenerateToken = async () => {
  const token = await window.api.agents.generateWebhookToken(
    store.config.workspaceId,
    props.agent.uuid
  )
  props.agent.webhookToken = token
}

const onCopyUrl = () => {
  navigator.clipboard.writeText(webhookUrl.value)
}

const validate = (): string|null => {
  return null
}

// Watch for visibility changes to prepare inputs
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    prepareAgentInvocationInputs()
  }
})

// Load HTTP port on mount
onMounted(async () => {
  httpPort.value = await window.api.app.getHttpPort()
})

defineExpose({ validate })

</script>

<style scoped>
.table-plain {
  padding: 0.5rem 1rem;
  width: 100%;
}

.variables {
  td:first-child {
    width: 33%;
  }
}

.webhook-url-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;

  input {
    flex: 1;
  }

  button {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
