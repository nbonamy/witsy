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

        <EditorGeneral 
          :agent="agent" 
          :visible="isStepVisible(kStepGeneral)" 
          :prev-button-text="t('common.cancel')" 
          :error="informationError" 
          @prev="onPrevStep" 
          @next="validateInformation" 
        />

        <EditorGoal 
          :agent="agent" 
          :visible="isStepVisible(kStepGoal)" 
          :error="informationError" 
          @prev="onPrevStep" 
          @next="validateGoal" 
        />

        <EditorModel 
          :agent="agent" 
          :visible="isStepVisible(kStepModel)" 
          :has-settings="hasSettings" 
          @prev="onPrevStep" 
          @next="validateModel" 
          @show-settings="showSettings"
        />

        <EditorSettings 
          :agent="agent" 
          :visible="isStepVisible(kStepSettings)" 
          @prev="onPrevStep" 
          @next="validateSettings" 
        />

        <EditorWorkflow 
          :agent="agent" 
          :visible="isStepVisible(kStepWorkflow)" 
          :error="informationError" 
          :expanded-step="expandedStep"
          @prev="onPrevStep" 
          @next="validateWorkflow"
          @update:expanded-step="expandedStep = $event"
        />

        <EditorInvocation 
          :agent="agent" 
          :visible="isStepVisible(kStepInvocation)" 
          :next-button-text="t('common.save')" 
          @prev="onPrevStep" 
          @next="validateInvocation" 
        />

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

import { ref, onMounted, computed, watch, PropType } from 'vue'
import { t } from '../services/i18n'
import { extractPromptInputs } from '../services/prompt'
import Dialog from '../composables/dialog'
import EditorGeneral from './Editor.General.vue'
import EditorGoal from './Editor.Goal.vue'
import EditorModel from './Editor.Model.vue'
import EditorSettings from './Editor.Settings.vue'
import EditorWorkflow from './Editor.Workflow.vue'
import EditorInvocation from './Editor.Invocation.vue'
import Agent from '../models/agent'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: () => new Agent(),
  },
  mode: {
    type: String as PropType<'create'|'edit'>,
    default: 'create',
  },
})

const emit = defineEmits(['cancel', 'save'])

const agent = ref<Agent>(new Agent())
const currentStep = ref(0)
const completedStep = ref(-1)
const informationError = ref('')
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
    // Step change logic moved to individual components
  })

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

const validateInformation = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  goToStepAfter(kStepGeneral)
}

const validateGoal = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  goToStepAfter(kStepGoal)
}

const validateModel = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  goToStepAfter(kStepModel, hasSettings.value ? 2 : 1)
}

const validateSettings = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  goToStepAfter(kStepSettings)
}

const validateWorkflow = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  goToStepAfter(kStepWorkflow)
}

const validateInvocation = (event?: { error: string }) => {
  if (event?.error) {
    informationError.value = event.error
    return
  }
  save()
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

      &:deep() {


        .panel {
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
        }

        .sticky-table-container {
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
 
    }

  }

}

</style>
