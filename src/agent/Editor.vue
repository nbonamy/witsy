<template>
  <div class="agent-editor" @keydown.enter="onSave">

    <div class="master-detail">
      
      <div class="md-master">

        <div class="md-master-header" v-if="mode === 'create'">
          <div class="md-master-header-title">Welcome to the Create&nbsp;Agent assistant</div>
          <div class="md-master-header-desc">
            Agents are autonomous entities used to automate workflows, answer questions, or interact with other systems.
          </div>
        </div>

        <div class="md-master-list">

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepGeneral), disabled: !isStepCompleted(kStepGeneral) }" @click="onStepClick(kStepGeneral)" v-if="hasStep(kStepGeneral)">
            <BIconCardHeading class="logo" /> {{ t('agent.create.information.title') }}
          </div>

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepGoal), disabled: !isStepCompleted(kStepGoal) }" @click="onStepClick(kStepGoal)" v-if="hasStep(kStepGoal)">
            <BIconBullseye class="logo" /> {{ t('agent.create.goal.title') }}
          </div>

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepModel) || isStepVisible(kStepSettings), disabled: !isStepCompleted(kStepModel) }" @click="onStepClick(kStepModel)" v-if="hasStep(kStepModel)">
            <BIconCpu class="logo" /> {{ t('agent.create.llm.title') }}
          </div>

          <!-- <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepSettings), disabled: !isStepCompleted(kStepSettings) }" @click="onStepClick(kStepSettings)">
            <BIconSliders class="logo" /> {{ t('agent.create.settings') }}
          </div> -->

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepWorkflow), disabled: !isStepCompleted(kStepWorkflow) }" @click="onStepClick(kStepWorkflow)" v-if="hasStep(kStepWorkflow)">
            <BIconDiagram2 class="logo scale120" /> {{ t('agent.create.workflow.title') }}
          </div>

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepInvocation), disabled: !isStepCompleted(kStepInvocation) }" @click="onStepClick(kStepInvocation)" v-if="hasStep(kStepInvocation)">
            <BIconLightningCharge class="logo" /> {{ t('agent.create.invocation.title') }}
          </div>

        </div>

        <div class="md-master-footer" v-if="mode === 'edit'">
          <div class="buttons">
            <button class="large" @click="emit('cancel')">{{ t('common.cancel') }}</button>
            <button class="large" @click="save">{{ t('common.save') }}</button>
          </div>
        </div>

      </div>
      
      <div class="md-detail form form-large form-vertical">

        <WizardStep :visible="isStepVisible(kStepGeneral)" :prev-button-text="t('common.cancel')" :error="informationError" @prev="onPrevStep" @next="validateInformation">
          <template #header>
            <label>{{ t('agent.create.information.title') }}</label>
          </template>
          <template #content>
            <div class="form-field">
              <label for="name">{{ t('agent.name') }}</label>
              <div class="help">{{ t('agent.create.information.help.name') }}</div>
              <input type="text" v-model="agent.name" name="name" required />
            </div>
            <div class="form-field">
              <label for="description">{{ t('agent.description') }}</label>
              <div class="help">{{ t('agent.create.information.help.description') }}</div>
              <textarea v-model="agent.description" name="description" required></textarea>
            </div>
            <div class="form-field">
              <label for="type">{{ t('agent.create.information.type') }}</label>
              <select v-model="agent.type" name="type">
                <option value="runnable">{{ t('agent.type.runnable') }}</option>
                <option value="support">{{ t('agent.type.support') }}</option>
              </select>
            </div>
          </template>
        </WizardStep>

        <WizardStep :visible="isStepVisible(kStepGoal)" :error="informationError" @prev="onPrevStep" @next="validateGoal">
          <template #header>
            <label>{{ t('agent.create.goal.title') }}</label>
          </template>
          <template #content>
            <div class="form-field">
              <label for="goal">{{ t('agent.goal') }}</label>
              <div class="help">{{ t('agent.create.information.help.goal') }}</div>
              <textarea v-model="agent.instructions" name="goal" required></textarea>
            </div>            
          </template>
        </WizardStep>

        <WizardStep :visible="isStepVisible(kStepModel)" @prev="onPrevStep" @next="validateModel">
          <template #header>
            <label>{{ t('agent.create.llm.title') }}</label>
            <div class="help">{{ t('agent.create.llm.help.warning') }}</div>
          </template>
          <template #content>
            <div class="form-field">
              <label>{{ t('common.llmProvider') }}</label>
              <EngineSelect v-model="agent.engine" :default-text="t('agent.create.llm.lastOneUsed')" @change="onChangeEngine"/>
            </div>
            <div class="form-field">
              <label>{{ t('common.llmModel') }}</label>
              <ModelSelect v-model="agent.model" :engine="agent.engine" :default-text="t('agent.create.llm.lastOneUsed')" @change="onChangeModel"/>
            </div>
            <div class="form-field">
              <label>{{ t('modelSettings.locale') }}</label>
              <LangSelect name="locale" v-model="agent.locale" default-text="modelSettings.localeDefault" />
            </div>
          </template>
          <template #buttons>
            <button @click="showSettings" v-if="hasSettings">{{ t('agent.create.llm.showModelSettings') }}</button>
          </template>
        </WizardStep>

        <WizardStep :visible="isStepVisible(kStepSettings)" @prev="onPrevStep" @next="validateSettings">
          <template #header>
            <label>{{ t('agent.create.settings.title') }}</label>
          </template>
          <template #content>
            <!-- <div class="form-field">
              <label>{{ t('modelSettings.streaming') }}</label>
              <select name="streaming" v-model="agent.disableStreaming">
            <option :value="false">{{ t('common.enabled') }}</option>
            <option :value="true">{{ t('common.disabled') }}</option>
              </select>
            </div> -->
            <div class="form-field">
              <label>{{ t('modelSettings.contextWindowSize') }}</label>
              <input type="text" name="contextWindowSize" v-model="agent.modelOpts.contextWindowSize" :placeholder="t('modelSettings.defaultModelValue')" />
            </div>
            <div class="form-field">
              <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
              <input type="text" name="maxTokens" v-model="agent.modelOpts.maxTokens" :placeholder="t('modelSettings.defaultModelValue')" />
            </div>
            <div class="form-field">
              <label>{{ t('modelSettings.temperature') }}</label>
              <input type="text" name="temperature" v-model="agent.modelOpts.temperature" :placeholder="t('modelSettings.defaultModelValue')" />
            </div>
            <div class="form-field">
              <label>{{ t('modelSettings.topK') }}</label>
              <input type="text" name="top_k" v-model="agent.modelOpts.top_k" :placeholder="t('modelSettings.defaultModelValue')" />
            </div>
            <div class="form-field">
              <label>{{ t('modelSettings.topP') }}</label>
              <input type="text" name="top_p" v-model="agent.modelOpts.top_p" :placeholder="t('modelSettings.defaultModelValue')" />
            </div>
          </template>
        </WizardStep>

        <WizardStep class="workflow" :visible="isStepVisible(kStepWorkflow)" :error="informationError" @prev="onPrevStep" @next="validateWorkflow">
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

        <WizardStep :visible="isStepVisible(kStepInvocation)" :next-button-text="t('common.save')" @prev="onPrevStep" @next="validateInvocation">
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

            <!-- <div class="form-field">
              <label for="webhook">{{ t('agent.trigger.webhook') }}</label>
              <input type="text" name="webhook" v-model="webhook" />
            </div> -->

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

        <!-- <template v-slot:footer="wizardProps">
          <div class="wizard-footer-left">
            <button @click.prevent="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
            <button v-if="props.mode == 'edit'" @click.prevent="save" class="alert-confirm">{{ t('common.save') }}</button>
          </div>
          <div class="wizard-footer-right">
            <button v-if="wizardProps.activeTabIndex > 0" @click.prevent="wizardProps.prevTab()">{{ t('common.wizard.prev') }}</button>
            <button v-if="!wizardProps.isLastStep" @click.prevent="wizardProps.nextTab()">{{ t('common.wizard.next') }}</button>
            <button v-else @click.prevent="save" class="finish-button alert-confirm">{{ t('common.wizard.last') }}</button>
          </div>
        </template> -->

      </div>

    </div>

    <ToolSelector ref="toolSelector" :tools="agent.steps[expandedStep]?.tools" @save="onSaveStepTools" />
    <AgentSelector ref="agentSelector" :exclude-agent-id="agent.uuid" @save="onSaveStepAgents" />

</div>
</template>

<script setup lang="ts">

import { ref, onMounted, computed, watch, PropType, h } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import { extractPromptInputs } from '../services/prompt'
import Dialog from '../composables/dialog'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import Scheduler from '../components/Scheduler.vue'
import WizardStep from '../components/WizardStep.vue'
import ToolSelector from '../screens/ToolSelector.vue'
import AgentSelector from '../screens/AgentSelector.vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Agent from '../models/agent'
import { BIconChevronCompactDown, BIconChevronDown, BIconThreeDotsVertical } from 'bootstrap-icons-vue'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: (): Agent | null => null,
  },
  mode: {
    type: String as PropType<'create'|'edit'>,
    default: 'create',
  },
})

const emit = defineEmits(['cancel', 'save'])

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const toolSelector = ref<typeof ToolSelector|null>(null)
const agentSelector = ref<typeof AgentSelector|null>(null)
const agent = ref<Agent>(new Agent())
const webhook = ref('')
const currentStep = ref(0)
const completedStep = ref(-1)
const informationError = ref('')
const invocationInputs = ref<Record<string, string>>({})
const expandedStep = ref<number>(0)

const kStepGeneral = 'general'
const kStepGoal = 'goal'
const kStepModel = 'model'
const kStepSettings = 'settings'
const kStepWorkflow = 'workflow'
const kStepInvocation = 'invocation'

const steps = (): string[] => {

  // a2a set-up is limited
  if (agent.value.source === 'a2a') {
    return [
      kStepGeneral,
      kStepModel,
      kStepSettings,
      kStepWorkflow,
      kStepInvocation
    ]
  }

  // default
  return [
    kStepGeneral,
    kStepGoal,
    kStepModel,
    kStepSettings,
    kStepWorkflow,
    kStepInvocation
  ]

}

const hasSettings = computed(() => {
  return hasStep(kStepSettings)
})

const nextRuns = computed(() => {
  if (!agent.value.schedule) return ''
  try {
    //console.log(agent.value.schedule)
    const interval = CronExpressionParser.parse(agent.value.schedule)
    return interval.take(3).map((date) => date.toDate().toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })).join('<br>')
  } catch (e) {
    return ''
  }
})

const invocationPrompt = computed(() => {
  const values = {...agent.value.invocationValues }
  const inputs = extractPromptInputs(agent.value.steps[0].prompt)
  inputs.forEach(input => {
    if (!values[input.name]?.length) {
      values[input.name] = t('agent.create.invocation.missingInput', { name: input.name })
    }
  })
  return agent.value.buildPrompt(0, values)
})

onMounted(async () => {

  // watch mode
  watch(() => props.mode, resetWizard, { immediate: true })

  // watch agent
  watch(() => props.agent || {}, () => {
    agent.value = props.agent ? Agent.fromJson(props.agent) : new Agent()
    resetWizard()
  
  }, { deep: false, immediate: true })

  // watch step change
  watch(currentStep, (newStep) => {
    if (newStep === stepIndex(kStepInvocation)) {
      prepareAgentInvocationInputs()
    }
  })

})

const promptInputs = (step: number) => {
  return extractPromptInputs(agent.value.steps[step].prompt).map((input) => {
    if (input.name.startsWith('output.')) {
      input.description = t('agent.create.workflow.help.outputVarDesc', { step: input.name.split('.')[1] })
    }
    return input
  })
}

const stepIndex = (step: string) => {
  return steps().indexOf(step)
}

const hasStep = (step: string) => {
  return stepIndex(step) >= 0
}

const isStepCompleted = (step: string) => {
  return stepIndex(step) <= completedStep.value + 1
}

const isStepVisible = (step: string) => {
  return stepIndex(step) === currentStep.value
}

const onPrevStep = () => {
  if (currentStep.value == stepIndex(kStepModel) + 2) {
    currentStep.value = stepIndex(kStepModel)
  } else if (currentStep.value > 0) {
    currentStep.value--
  } else {
    emit('cancel')
  }
}

const showSettings = () => {
  currentStep.value = stepIndex(kStepSettings)
}

const onStepClick = (step: string) => {
  currentStep.value = stepIndex(step)
}

const goToStepAfter = (step: string, stepSize: number = 1) => {
  informationError.value = ''
  const currentIndex = stepIndex(step)
  currentStep.value = currentIndex + stepSize
  completedStep.value = Math.max(completedStep.value, currentIndex)
}

// prepare inputs for the invocation screen
const prepareAgentInvocationInputs = () => {
  invocationInputs.value = {}
  const inputs = extractPromptInputs(agent.value.steps[0].prompt)
  inputs.forEach(input => {
    invocationInputs.value[input.name] = agent.value.invocationValues[input.name] || input.defaultValue|| ''
  })
}

const saveInvocationInputs = () => {
  agent.value.invocationValues = { ...invocationInputs.value }
}

const onAddStep = (index: number) => {
  agent.value.steps.push({
    prompt: `{{output.${index-1}}}`,
    tools: [],
    agents: [],
  })
}

const onToolsStep = (index: number) => {
  toolSelector.value?.show(agent.value.steps[index].tools)
}

const onSaveStepTools = (tools: string[]) => {
  agent.value.steps[expandedStep.value].tools = tools
}

const onAgentsStep = (index: number) => {
  agentSelector.value?.show(agent.value.steps[index].agents)
}

const onSaveStepAgents = (agents: string[]) => {
  agent.value.steps[expandedStep.value].agents = agents
}

const toggleStepExpansion = (index: number) => {
  expandedStep.value = expandedStep.value === index ? -1 : index
}

const onDeleteStep = async (index: number) => {
  const rc = await Dialog.show({
    title: t('agent.create.workflow.confirmDeleteStep'),
    text: t('common.confirmation.cannotUndo'),
    showCancelButton: true,
  })
  if (rc.isConfirmed) {
    agent.value.steps.splice(index, 1)
  }
}

const validateInformation = () => {
  if (!agent.value.name.trim().length ||
      !agent.value.description.trim().length) {
    informationError.value = t('common.required.fieldsRequired')
    return
  }
  goToStepAfter(kStepGeneral)
}

const validateGoal = () => {
  if (!agent.value.instructions.trim().length) {
    informationError.value = t('common.required.fieldsRequired')
    return
  }
  goToStepAfter(kStepGoal)
}

const validateModel = () => {
  goToStepAfter(kStepModel, hasSettings.value ? 2 : 1)
}

const validateSettings = () => {
  goToStepAfter(kStepSettings)
}

const validateWorkflow = () => {

  // constraints on the workflow
  if (agent.value.steps.length > 1) {
    for (let i = 1; i < agent.value.steps.length; i++) {
      if (!agent.value.steps[i].prompt.trim().length) {
        informationError.value = t('agent.create.workflow.error.emptyStepPrompt', { step: i + 1 })
        return
      }
    }
  }

  // next
  goToStepAfter(kStepWorkflow)
}

const validateInvocation = () => {
  save()
}

const onChangeEngine = () => {
  agent.value.model = llmManager.getDefaultChatModel(agent.value.engine, false)
  onChangeModel()
}

const onChangeModel = () => {
}

const resetWizard = () => {
  currentStep.value = stepIndex(kStepGeneral)
  completedStep.value = props.mode === 'edit' ? steps().length - 1 : -1
  expandedStep.value = (props.mode === 'edit' && agent.value.steps.length > 1) ? -1 : 0
  informationError.value = ''
}

const save = async () => {

  if (agent.value.schedule) {
    const inputs = extractPromptInputs(agent.value.steps[0].prompt)
    for (const input of inputs) {
      if (agent.value.invocationValues[input.name] === undefined) {
        
        const rc = await Dialog.show({
          title: t('agent.create.invocation.missingInputs.title'),
          text: t('agent.create.invocation.missingInputs.text'),
          customClass: { actions: 'actions-stacked' },
          confirmButtonText: t('agent.create.invocation.missingInputs.confirmButtonText'),
          cancelButtonText: t('agent.create.invocation.missingInputs.cancelButtonText'),
          showCancelButton: true,
        })

        if (rc.isConfirmed) {
          return
        }
      }
    }
  }

  // we can save
  const rc = window.api.agents.save(JSON.parse(JSON.stringify(agent.value)))
  if (rc) {
    emit('save', agent.value)
  }
}

</script>


<style scoped>

.agent-editor {

  .master-detail {
    
    width: 100%;

    .md-master {

      .md-master-list {

        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        .md-master-list-item {

          &.selected {
            background-color: var(--window-decoration-color);
          }

          &.disabled {
            opacity: 0.5;
            pointer-events: none;
          }
        }
      }

      .md-master-footer {

        padding-top: 2rem;
        border-top: 1px solid var(--sidebar-border-color);
        margin-top: 1rem;

        .buttons {
          display: flex;
          justify-content: center;
        }

      }


    }

    .md-detail {

      margin-top: 1rem;
      margin-bottom: 2rem;

      &:deep() .panel {
        .panel-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .help {
          font-size: 11pt;
          font-weight: normal;
          color: var(--faded-text-color);
        }
      }

      .form-field .help {
        font-size: 10.5pt;
        color: var(--faded-text-color);
        margin-bottom: 0.25rem;
      }

      textarea {
        flex: auto;
        min-height: 5lh;
        resize: vertical;

        &[name=goal] {
          min-height: 15lh;
        }
      }

      &:deep() .sticky-table-container {
        margin-top: 2rem;
        max-height: 20rem;
        th, td {
          vertical-align: top;
          padding: 0.5rem;
          div {
            white-space: wrap;
            max-height: 3lh;
            overflow-y: clip;
            text-overflow: ellipsis;
          }
        }
      }
 
    }

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

    .variables {
      td:first-child {
        width: 33%;
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

  }

}

</style>
