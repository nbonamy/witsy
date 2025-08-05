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
              <div class="help" v-if="step.docrepo">{{ t('agent.create.workflow.help.docRepo') }}</div>
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
              <button class="docrepo" @click="onDocRepo(index)"><BIconDatabase /> {{ t('agent.create.workflow.docRepo') }}</button>
              <button class="tools" @click="onTools(index)"><BIconTools /> {{ t('agent.create.workflow.customTools') }}</button>
              <button class="agents" @click="onAgents(index)"><BIconRobot /> {{ t('agent.create.workflow.customAgents') }}</button>
              <button class="structured-output" @click="onStructuredOutput(index)"><BIconFiletypeJson /> {{ t('agent.create.workflow.jsonSchema') }}</button>
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

  <ToolSelector ref="toolSelector" :tools="currentStepTools" @save="onSaveTools" />
  <AgentSelector ref="agentSelector" :exclude-agent-id="agent.uuid" @save="onSaveAgents" />
</template>

<script setup lang="ts">
import { kAgentStepVarFacts, kAgentStepVarOutputPrefix } from '../types/index'
import { ref, watch, computed, PropType } from 'vue'
import { t } from '../services/i18n'
import { processJsonSchema } from '../services/schema'
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
  props.agent.steps.push({
    prompt: `{{${kAgentStepVarOutputPrefix}${index-1}}}`,
    tools: [],
    agents: [],
  })
  expandedStep.value = index-1
  emit('update:expanded-step', expandedStep.value)
}

const onDocRepo = async (index: number) => {

  // get the list of doc repositories
  const docRepos = window.api.docrepo.list()

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

  // all steps after one must have a prompt
  if (props.agent.steps.length > 1) {
    for (let i = 1; i < props.agent.steps.length; i++) {
      const step = props.agent.steps[i]
      if (props.agent.steps.length > 1 && !step.prompt.trim().length) {
        emit('next', { error: t('agent.create.workflow.error.emptyStepPrompt', { step: i + 1 }) })
        return
      }
    }
  }

  // // now check individual steps
  // for (let i = 0; i < props.agent.steps.length; i++) {
  //   const step = props.agent.steps[i]
  //   if (step.docrepo && !step.prompt?.includes(kAgentStepVarFacts)) {
  //     emit('next', { error: t('agent.create.workflow.error.missingDocRepo', { step: i + 1 }) })
  //     return
  //   }
  // }

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
