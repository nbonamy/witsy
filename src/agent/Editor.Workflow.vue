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
            <label>
              <div class="step-icon">
                <MousePointerClickIcon />
              </div>
              <div class="step-info">
                <div class="step-info-number">{{ t('agent.create.workflow.step', { step: index + 1 }) }}</div>
                <div class="step-info-name" v-html="step.description || 'Step Name'"></div>
              </div>
            </label>
            <Trash2Icon class="icon delete" @click.stop="onDeleteStep(index)" v-if="agent.steps.length > 1" />
            <ChevronDownIcon v-if="expandedStep === index" class="icon caret" />
            <ChevronRightIcon v-else class="icon caret" />
          </div>
          <div class="panel-body" v-if="expandedStep === index">
            <div class="form-field">
              <label for="description">{{ t('agent.create.workflow.description') }}</label>
              <div class="help">{{ t('agent.create.workflow.help.description') }}</div>
              <input v-model="agent.steps[index].description"></input>
            </div>
            <div class="form-field">
              <label for="prompt">{{ t('common.prompt') }}</label>
              <div class="help">{{ t('agent.create.workflow.help.prompt') }}</div>
              <textarea v-model="agent.steps[index].prompt"></textarea>
              <div class="help" v-if="index > 0">{{ t('agent.create.workflow.help.connect') }}</div>
              <div class="help" v-if="step.docrepo">{{ t('agent.create.workflow.help.docRepo') }}</div>
            </div>
            <div class="variables" v-if="promptInputs(index).length">
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
          </div>
          <div class="panel-footer step-actions" v-if="expandedStep === index">
            <button class="docrepo" @click="onDocRepo(index)"><LightbulbIcon /> {{ t('agent.create.workflow.docRepo') }}</button>
            <button class="tools" @click="onTools(index)"><BlocksIcon /> {{ t('agent.create.workflow.customTools') }}</button>
            <button class="agents" @click="onAgents(index)"><AgentIcon /> {{ t('agent.create.workflow.customAgents') }}</button>
            <button class="structured-output" @click="onStructuredOutput(index)"><BracesIcon /> {{ t('agent.create.workflow.jsonSchema') }}</button>
          </div>
        </div>
        <div class="step-footer">
          <div class="workflow-arrow" v-if="index < agent.steps.length - 1"></div>
          <button class="add-step tertiary" name="add-step" @click="onAddStep(index+1)"><PlusIcon /> {{ t('agent.create.workflow.addStep') }}</button>
        </div>
      </template>
    </template>
  </WizardStep>

  <ToolSelector ref="toolSelector" :tools="currentStepTools" @save="onSaveTools" />
  <AgentSelector ref="agentSelector" :exclude-agent-id="agent.uuid" @save="onSaveAgents" />
</template>

<script setup lang="ts">
import { BlocksIcon, BracesIcon, ChevronDownIcon, ChevronRightIcon, LightbulbIcon, MousePointerClickIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, PropType, ref, watch } from 'vue'
import AgentIcon from '../../assets/agent.svg?component'
import WizardStep from '../components/WizardStep.vue'
import Dialog from '../composables/dialog'
import Agent from '../models/agent'
import AgentSelector from '../screens/AgentSelector.vue'
import ToolSelector from '../screens/ToolSelector.vue'
import { t } from '../services/i18n'
import { extractPromptInputs } from '../services/prompt'
import { processJsonSchema } from '../services/schema'
import { store } from '../services/store'
import { kAgentStepVarFacts, kAgentStepVarOutputPrefix } from '../types/index'

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
    if (input.name.startsWith(kAgentStepVarOutputPrefix)) {
      input.description = t('agent.create.workflow.help.outputVarDesc', { step: input.name.split('.')[1] })
    }
    if (input.name === kAgentStepVarFacts) {
      input.description = t('agent.create.workflow.help.factsVarDesc')
    }
    return input
  })
}

const toggleStepExpansion = (index: number) => {
  expandedStep.value = expandedStep.value === index ? -1 : index
  emit('update:expanded-step', expandedStep.value)
}

const onAddStep = (index: number) => {
  props.agent.steps.splice(index, 0, {
    prompt: `{{${kAgentStepVarOutputPrefix}${index-1}}}`,
    tools: [],
    agents: [],
  })
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
}

const onDocRepo = async (index: number) => {

  // get the list of doc repositories
  const docRepos = window.api.docrepo.list(store.config.workspaceId)

  const rc = await Dialog.show({
    title: t('common.docRepo'),
    input: 'select',
    inputOptions: {
      'none': t('agent.create.workflow.docRepoNone'),
      ...docRepos.reduce((acc, repo) => {
        acc[repo.uuid] = repo.name
        return acc
      }, {} as Record<string, any>),
    },
    inputValue: props.agent.steps[index].docrepo || 'none',
    showCancelButton: true,
  })

  // save
  if (rc.isConfirmed) {
    props.agent.steps[index].docrepo = rc.value === 'none' ? undefined : rc.value

    // // update prompt
    // if (props.agent.steps[index].docrepo) {
    //   if (!(props.agent.steps[index].prompt?.length)) {
    //     props.agent.steps[index].prompt = `{{${kAgentStepVarFacts}}}`
    //   } else if (!props.agent.steps[index].prompt.includes(`{{${kAgentStepVarFacts}}}`)) {
    //     props.agent.steps[index].prompt += `\n\n{{${kAgentStepVarFacts}}}`
    //   }
    // } else if (props.agent.steps[index].prompt) {
    //   props.agent.steps[index].prompt = props.agent.steps[index].prompt.replaceAll(`{{${kAgentStepVarFacts}}}`, '')
    // }

  }

}

const onTools = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  toolSelector.value?.show(props.agent.steps[index].tools)
}

const onSaveTools = (tools: string[]) => {
  props.agent.steps[expandedStep.value].tools = tools
}

const onAgents = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  agentSelector.value?.show(props.agent.steps[index].agents)
}

const onSaveAgents = (agents: string[]) => {
  props.agent.steps[expandedStep.value].agents = agents
}

const onStructuredOutput = async (index: number) => {
  
  const rc = await Dialog.show({
    title: t('agent.create.workflow.structuredOutput.title'),
    html: t('agent.create.workflow.structuredOutput.text'),
    customClass: { popup: 'x-large' },
    input: 'textarea',
    inputValue: props.agent.steps[index].jsonSchema,
    showCancelButton: true,
    confirmButtonText: t('common.save'),
    inputValidator: (value: string) => {

      if (!value.trim()) {
        return null
      }
      
      try {
        const schema = processJsonSchema('response', value)
        if (!schema) {
          return t('agent.create.workflow.error.structuredOutput')
        }
      } catch (e) {
        return t('agent.create.workflow.error.structuredOutput')
      }
    }
  })

  if (rc.isConfirmed) {
    try {
      if (!rc.value.trim()) {
        props.agent.steps[index].jsonSchema = undefined
      } else {
        props.agent.steps[index].jsonSchema = rc.value.trim()
      }
    } catch (e) {
      // This shouldn't happen due to validation, but just in case
      console.error('Failed to parse structured output:', e)
    }
  }
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
  emit('next')
}

const validate = (): string|null => {
  // all steps after one must have a prompt
  if (props.agent.steps.length > 1) {
    for (let i = 1; i < props.agent.steps.length; i++) {
      const step = props.agent.steps[i]
      if (props.agent.steps.length > 1 && !step.prompt.trim().length) {
        return t('agent.create.workflow.error.emptyStepPrompt', { step: i + 1 })
      }
    }
  }

  // // now check individual steps
  // for (let i = 0; i < props.agent.steps.length; i++) {
  //   const step = props.agent.steps[i]
  //   if (step.docrepo && !step.prompt?.includes(kAgentStepVarFacts)) {
  //     return t('agent.create.workflow.error.missingDocRepo', { step: i + 1 })
  //   }
  // }

  return null
}

defineExpose({ validate })
</script>

<style scoped>
.table-plain {
  padding: 0.5rem 1rem;
  width: 100%;
}

.variables {
  
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  width: calc(100% - 2px);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;

  label {
    padding: 0.5rem 0.75rem;
    font-weight: bold;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--background-color-light);
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-family: monospace;
    font-size: 12.5px;
  }

  .prompt-inputs {

    th {
      border: none;
      font-weight: 600;
    }

    th, td {
      font-family: monospace;
      font-size: 12px;
    }

    td:first-child {
      width: 25%;
    }
    td:last-child {
      width: 25%;
    }
  }
}

.workflow:deep() {
  .panel-body {
    padding-top: 2rem;
    gap: 0rem;
    overflow: auto;
    align-items: center;

    .step-panel {
      margin: 0;
      flex-shrink: 0;
      align-self: stretch;
      gap: 0rem;
      background-color: var(--background-color);

      .panel-header, .panel-body {
        padding: 1.5rem;
      }

      .panel-header {
        cursor: pointer;
        flex-direction: row !important;

        label {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 1rem;
          cursor: pointer;

          .step-icon {
            padding: 0.5rem;
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 6px;
            background-color: var(--color-on-surface);
            svg {
              color: var(--color-on-primary);
              width: 1.5rem;
              height: 1.5rem;
            }
          }

          .step-info {

            display: flex;
            flex-direction: column;
            gap: 0.25rem;

            .step-info-number {
              font-weight: 300;
            }
          }


        }

      }

      .panel-body {
        gap: 0rem;
        padding-top: 0px;
        input, textarea, select {
          background-color: var(--color-surface);
        }
      }
    }

    .step-actions {
      padding: 1rem;
      background-color: var(--color-surface);
      border-top: 1px solid var(--border-color);
      border-bottom-left-radius: 0.5rem;
      border-bottom-right-radius: 0.5rem;
      display: flex;
      justify-content: flex-start;

      button {
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        svg {
          color: var(--color-on-surface);
        }
      }
    }
  }

  .step-footer {

    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    height: 4rem;

    .workflow-arrow {
      align-self: flex-start;
      margin-left: 2rem;
      width: 1px;
      height: 100%;
      background-color: var(--color-outline-variant);
    }

    .add-step {
      margin-left: auto;
    }
  }
}

</style>
