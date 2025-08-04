<template>
  <WizardStep class="workflow" :visible="visible" :error="error" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.workflow.title') }}</label>
      <div class="help">{{ t('agent.create.workflow.help.title') }}</div>
    </template>
    <template #content>
      <template v-for="(step, index) in agent.steps" :key="index">
        <div class="panel step-panel">
          <div class="panel-header" @click="toggleStepExpansion(index)">
            <BIconCaretDownFill v-if="expandedStep === index" class="icon caret" />
            <BIconCaretRightFill v-else class="icon caret" />
            <label v-if="step.description && expandedStep !== index">{{ t('agent.create.workflow.stepFull', { step: index + 1, text: step.description }) }}</label>
            <label v-else>{{ t('agent.create.workflow.step', { step: index + 1 }) }}</label>
            <BIconTrash class="icon delete" @click.stop="onDeleteStep(index)" v-if="index > 0 && expandedStep === index"/>
          </div>
          <div class="panel-body" v-if="expandedStep === index">
            <div class="form-field">
              <label for="description">{{ t('agent.create.workflow.description') }}</label>
              <input v-model="agent.steps[index].description"></input>
            </div>
            <div class="form-field">
              <label for="prompt">{{ t('common.prompt') }}</label>
              <textarea v-model="agent.steps[index].prompt"></textarea>
              <div class="help" v-if="index > 0">{{ t('agent.create.workflow.help.connect') }}</div>
            </div>
            <div class="form-field" v-if="promptInputs(index).length">
              <label for="prompt">{{ t('agent.create.information.promptInputs') }}</label>
              <table class="table-plain prompt-inputs">
                <thead><tr>
                  <th>{{ t('common.name') }}</th>
                  <th>{{ t('common.description') }}</th>
                  <th>{{ t('common.defaultValue') }}</th>
                </tr></thead>
                <tbody><tr v-for="(input, idx2) in promptInputs(index)" :key="idx2">
                  <td>{{ input.name }}</td>
                  <td>{{ input.description }}</td>
                  <td>{{ input.defaultValue }}</td>
                </tr></tbody>
              </table>
            </div>
            <div class="step-actions">
              <button class="tools" @click="onToolsStep(index)">{{ t('agent.create.workflow.customTools') }}</button>
              <button class="agents" @click="onAgentsStep(index)">{{ t('agent.create.workflow.customAgents') }}</button>
            </div>
          </div>
        </div>
        <div class="workflow-arrow" v-if="index < agent.steps.length - 1">
          <BIconThreeDotsVertical  />
        </div>
      </template>
    </template>
    <template #buttons>
      <button name="add-step" @click="onAddStep(agent.steps.length+1)">{{ t('agent.create.workflow.addStep') }}</button>
    </template>
  </WizardStep>

  <ToolSelector ref="toolSelector" :tools="currentStepTools" @save="onSaveStepTools" />
  <AgentSelector ref="agentSelector" :exclude-agent-id="agent.uuid" @save="onSaveStepAgents" />
</template>

<script setup lang="ts">
import { ref, watch, computed, PropType } from 'vue'
import { t } from '../services/i18n'
import { extractPromptInputs } from '../services/prompt'
import Dialog from '../composables/dialog'
import WizardStep from '../components/WizardStep.vue'
import ToolSelector from '../screens/ToolSelector.vue'
import AgentSelector from '../screens/AgentSelector.vue'
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
  error: {
    type: String,
    default: '',
  },
  expandedStep: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['prev', 'next', 'update:expanded-step'])

const toolSelector = ref<typeof ToolSelector|null>(null)
const agentSelector = ref<typeof AgentSelector|null>(null)
const expandedStep = ref(props.expandedStep)

const currentStepTools = computed(() => {
  return expandedStep.value >= 0 ? props.agent.steps[expandedStep.value]?.tools : []
})

// Watch for prop changes
watch(() => props.expandedStep, (newValue) => {
  expandedStep.value = newValue
})

const promptInputs = (step: number) => {
  return extractPromptInputs(props.agent.steps[step].prompt).map((input) => {
    if (input.name.startsWith('output.')) {
      input.description = t('agent.create.workflow.help.outputVarDesc', { step: input.name.split('.')[1] })
    }
    return input
  })
}

const toggleStepExpansion = (index: number) => {
  expandedStep.value = expandedStep.value === index ? -1 : index
  emit('update:expanded-step', expandedStep.value)
}

const onAddStep = (index: number) => {
  props.agent.steps.push({
    prompt: `{{output.${index-1}}}`,
    tools: [],
    agents: [],
  })
  expandedStep.value = index-1
  emit('update:expanded-step', expandedStep.value)
}

const onToolsStep = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  toolSelector.value?.show(props.agent.steps[index].tools)
}

const onSaveStepTools = (tools: string[]) => {
  props.agent.steps[expandedStep.value].tools = tools
}

const onAgentsStep = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  agentSelector.value?.show(props.agent.steps[index].agents)
}

const onSaveStepAgents = (agents: string[]) => {
  props.agent.steps[expandedStep.value].agents = agents
}

const onDeleteStep = async (index: number) => {
  const rc = await Dialog.show({
    title: t('agent.create.workflow.confirmDeleteStep'),
    text: t('common.confirmation.cannotUndo'),
    showCancelButton: true,
  })
  if (rc.isConfirmed) {
    props.agent.steps.splice(index, 1)
  }
}

const onNext = () => {
  // constraints on the workflow
  if (props.agent.steps.length > 1) {
    for (let i = 1; i < props.agent.steps.length; i++) {
      if (!props.agent.steps[i].prompt.trim().length) {
        emit('next', { error: t('agent.create.workflow.error.emptyStepPrompt', { step: i + 1 }) })
        return
      }
    }
  }

  emit('next')
}
</script>

<style scoped>
.table-plain {
  padding: 0.5rem 1rem;
  width: 100%;
}

.prompt-inputs {
  td:first-child {
    width: 25%;
  }
  td:last-child {
    width: 25%;
  }
}

.workflow:deep() {
  .panel-body {
    padding-top: 2rem;
    gap: 1rem;
    overflow: auto;
    align-items: center;

    .step-panel {
      margin: 0;
      padding: 0;
      flex-shrink: 0;
      width: 600px;

      .panel-header {
        cursor: pointer;
        flex-direction: row !important;
        padding: 0.5rem 1rem;
        label {
          cursor: pointer;
        }
      }

      .panel-body {
        padding: 0.5rem 1rem;
        gap: 0rem;
      }
    }

    .step-actions {
      width: 100%;
      margin: 0.25rem 0rem;
      display: flex;
      justify-content: flex-end;
    }
  }

  .workflow-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
}
</style>
