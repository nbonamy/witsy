
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

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepTools), disabled: !isStepCompleted(kStepTools) }" @click="onStepClick(kStepTools)" v-if="hasStep(kStepTools)">
            <BIconTools class="logo" /> {{ t('agent.create.tools.title') }}
          </div>

          <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepAgents), disabled: !isStepCompleted(kStepAgents) }" @click="onStepClick(kStepAgents)" v-if="hasStep(kStepAgents)">
            <BIconRobot class="logo" /> {{ t('agent.create.agents.title') }}
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
            <div class="form-field">
              <label>{{ t('modelSettings.streaming') }}</label>
              <select name="streaming" v-model="agent.disableStreaming">
            <option :value="false">{{ t('common.enabled') }}</option>
            <option :value="true">{{ t('common.disabled') }}</option>
              </select>
            </div>
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

        <WizardStep :visible="isStepVisible(kStepWorkflow)" @prev="onPrevStep" @next="validateWorkflow">
          <template #header>
            <label>{{ t('agent.create.workflow.title') }}</label>
            <div class="help">{{ t('agent.create.workflow.help.singleOnly') }}</div>
          </template>
          <template #content>
            <div class="form-field">
              <label for="prompt">{{ t('agent.prompt') }}</label>
              <div class="help">{{ t('agent.create.information.help.prompt') }}</div>
              <textarea v-model="agent.prompt" name="prompt"></textarea>
            </div>
            <div class="form-field" v-if="promptInputs.length">
              <label for="prompt">{{ t('agent.create.information.promptInputs') }}</label>
              <table class="prompt-inputs">
                <thead><tr>
                  <th>{{ t('common.name') }}</th>
                  <th>{{ t('common.description') }}</th>
                  <th>{{ t('common.defaultValue') }}</th>
                </tr></thead>
                <tbody><tr v-for="(input, index) in promptInputs" :key="index">
                  <td>{{ input.name }}</td>
                  <td>{{ input.description }}</td>
                  <td>{{ input.defaultValue }}</td>
                </tr></tbody>
              </table>
            </div>
          </template>
        </WizardStep>

        <WizardStep :visible="isStepVisible(kStepTools)" @prev="onPrevStep" @next="validateTools">
          <template #header>
            <label>{{ t('agent.create.tools.title') }}</label>
            <div class="help">{{ t('agent.create.tools.help') }}</div>
          </template>
          <template #content>

            <div class="form-field horizontal">
              <input type="checkbox" v-model="allToolsAllowed" @change="onCustomTools"/>
              {{ t('agent.create.tools.allowAll') }}
            </div>

            <div class="tools" v-if="!allToolsAllowed">
              <ToolTable v-model="agent.tools" @toggle="agent.tools = toolTable.toggleTool(agent.tools, $event)" ref="toolTable" />
              <div class="form-field horizontal">
                <button class="all" @click.prevent="agent.tools = null">{{ t('agent.create.tools.selectAll') }}</button>
                <button class="none" @click.prevent="agent.tools = []">{{ t('agent.create.tools.selectNone') }}</button>
              </div>
            </div>

          </template>
        </WizardStep>

        <WizardStep :visible="isStepVisible(kStepAgents)" @prev="onPrevStep" @next="validateAgents">
          <template #header>
            <label>{{ t('agent.create.agents.title') }}</label>
            <div class="help">{{ t('agent.create.agents.help') }}</div>
          </template>
          <template #content>
            <div class="agents sticky-table-container">
              <table>
                <thead>
                  <tr>
                    <th>&nbsp;</th>
                    <th>{{ t('common.name') }}</th>
                    <th>{{ t('common.description') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="support in supportAgents" :key="support.id" class="tool" @click="toggleAgent(support)">
                    <td class="agent-enabled"><input type="checkbox" :checked="agent.agents.includes(support.id)" /></td>
                    <td class="agent-name">{{ support.name }}</td>
                    <td class="agent-description"><div>{{ support.description }}</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
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

            <div class="form-field">
              <label for="webhook">{{ t('agent.trigger.webhook') }}</label>
              <input type="text" name="webhook" v-model="webhook" />
            </div>

            <!-- <div class="form-field">
              <label for="prompt">{{ t('agent.prompt') }}</label>
              <textarea v-model="agent.prompt" name="prompt" rows="4"></textarea>
            </div> -->

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

  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, computed, watch, PropType, h } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import { extractPromptInputs } from '../services/prompt'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import Scheduler from '../components/Scheduler.vue'
import WizardStep from '../components/WizardStep.vue'
import ToolTable from '../components/ToolTable.vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Agent from '../models/agent'
import { BIconBullseye } from 'bootstrap-icons-vue'

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

const agent = ref<Agent>(new Agent())
const allToolsAllowed = ref(true)
const toolTable = ref(null)
const webhook = ref('')
const currentStep = ref(0)
const completedStep = ref(-1)
const informationError = ref('')

const kStepGeneral = 'general'
const kStepGoal = 'goal'
const kStepModel = 'model'
const kStepSettings = 'settings'
const kStepWorkflow = 'workflow'
const kStepTools = 'tools'
const kStepAgents = 'agents'
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
    kStepTools,
    kStepAgents,
    kStepInvocation
  ]

}

const promptInputs = computed(() => {
  return extractPromptInputs(agent.value.prompt)
})

const hasSettings = computed(() => {
  return hasStep(kStepSettings)
})

const supportAgents = computed(() => {
  return store.agents.filter(a => a.id !== agent.value.id).sort((a, b) => a.name.localeCompare(b.name))
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
  goToStepAfter(kStepWorkflow)
}

const validateTools = () => {
  goToStepAfter(kStepTools)
}

const validateAgents = () => {
  goToStepAfter(kStepAgents)
}

const validateInvocation = () => {
  if ((agent.value.schedule || webhook.value) && !agent.value.prompt) {
    alert(t('agent.create.invocation.promptRequired'))
    return false
  }
  save()
}

const onChangeEngine = () => {
  agent.value.model = llmManager.getDefaultChatModel(agent.value.engine, false)
  onChangeModel()
}

const onChangeModel = () => {
}

const onCustomTools = () => {
  if (allToolsAllowed.value) {
    agent.value.tools = null
  }
}

const toggleAgent = (support: Agent) => {
  if (agent.value.agents.includes(support.id)) {
    agent.value.agents = agent.value.agents.filter(a => a !== support.id)
  } else {
    agent.value.agents.push(support.id)
  }
}

onMounted(async () => {
  watch(() => props || {}, async () => {
    agent.value = props.agent ? JSON.parse(JSON.stringify(props.agent)) : new Agent()
    allToolsAllowed.value = (agent.value.tools === null)
    await toolTable.value?.initTools()
    currentStep.value = stepIndex(kStepGeneral)
    completedStep.value = props.mode === 'edit' ? steps().length - 1 : -1
  }, { deep: true, immediate: true })
})

const save = async () => {
  const rc = await window.api.agents.save(JSON.parse(JSON.stringify(agent.value)))
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

      &:deep() .panel {
        .panel-header {
          flex-direction: column;
          align-items: flex-start;
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
        min-height: 5lh;
        resize: vertical;
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

    .prompt-inputs {
      
      padding: 0.5rem 1rem;
      width: 100%;
      
      th, td {
        padding: 0.25rem;
        vertical-align: middle;
      }

      th {
        text-align: left;
        border-bottom: 1px solid var(--text-color);
      }

      td:first-child {
        width: 25%;
      }
      td:last-child {
        width: 25%;
      }
    }

  }

}

</style>
