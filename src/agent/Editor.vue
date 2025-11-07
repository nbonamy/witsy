<template>
  <div class="agent-editor" @keydown.enter="onSave">

    <header>
      <div class="title">{{ agent.name || t('agent.forge.create') }}</div>
      <div class="spacer"></div>
      <button class="large tertiary" name="cancel" @click="emit('cancel')">{{ t('common.cancel') }}</button>
      <button class="large secondary" name="prev" @click="onPrevStep" v-if="currentStep > 0">{{ t('common.back') }}</button>
      
      <button class="large default" name="next" @click="onNextStep">
        {{ isStepVisible(kStepInvocation) ? t('common.save') : t('common.next') }}
      </button>
    </header>

    <main>

      <div class="wizard">

        <div class="wizard-header">

          <div class="wizard-steps">

            <div class="wizard-step" :class="{ active: isStepVisible(kStepGeneral), completed: isStepCompleted(kStepGeneral) }" @click="onStepClick(kStepGeneral)" v-if="hasStep(kStepGeneral)">
              <Settings2Icon class="icon" /> {{ t('agent.create.information.title') }}
            </div>

            <!-- <div class="md-master-list-item" :class="{ selected: isStepVisible(kStepGoal), disabled: !isStepCompleted(kStepGoal) }" @click="onStepClick(kStepGoal)" v-if="hasStep(kStepGoal)">
              <TargetIcon class="logo" /> {{ t('agent.create.goal.title') }}
            </div> -->

            <div class="wizard-step" :class="{ active: isStepVisible(kStepModel) || isStepVisible(kStepSettings), completed: isStepCompleted(kStepModel) }" @click="onStepClick(kStepModel)" v-if="hasStep(kStepModel)">
              <BoxIcon class="icon" /> {{ t('agent.create.llm.title') }}
            </div>

            <div class="wizard-step" :class="{ active: isStepVisible(kStepWorkflow), completed: isStepCompleted(kStepWorkflow) }" @click="onStepClick(kStepWorkflow)" v-if="hasStep(kStepWorkflow)">
              <FlowIcon class="icon" /> {{ t('agent.create.workflow.title') }}
            </div>

            <div class="wizard-step" :class="{ active: isStepVisible(kStepInvocation), completed: isStepCompleted(kStepInvocation) }" @click="onStepClick(kStepInvocation)" v-if="hasStep(kStepInvocation)">
              <TriggerIcon class="icon" /> {{ t('agent.create.invocation.title') }}
            </div>

          </div>

        </div>
        
        <div class="wizard-body form form-large form-vertical">

          <EditorGeneral ref="stepGeneral"
            :agent="agent" 
            :visible="isStepVisible(kStepGeneral)" 
            :prev-button-text="t('common.cancel')" 
            :error="informationError" 
            @prev="onPrevStep" 
            @next="validateInformation" 
          />

          <EditorModel ref="stepModel"
            :agent="agent" 
            :visible="isStepVisible(kStepModel)" 
            :has-settings="hasSettings" 
            @prev="onPrevStep" 
            @next="validateModel" 
            @show-settings="showSettings"
          />

          <EditorSettings ref="stepSettings"
            :agent="agent" 
            :visible="isStepVisible(kStepSettings)" 
            @prev="onPrevStep" 
            @next="validateSettings" 
          />

          <EditorWorkflow ref="stepWorkflow"
            :agent="agent" 
            :visible="isStepVisible(kStepWorkflow)" 
            :error="informationError" 
            :expanded-step="expandedStep"
            @prev="onPrevStep" 
            @next="validateWorkflow"
            @update:expanded-step="expandedStep = $event"
          />

          <EditorInvocation ref="stepInvocation"
            :agent="agent"
            :visible="isStepVisible(kStepInvocation)"
            :next-button-text="t('common.save')"
            :error="informationError"
            @prev="onPrevStep"
            @next="validateInvocation"
          />

        </div>

      </div>

    </main>

</div>
</template>

<script setup lang="ts">

import { BoxIcon, Settings2Icon } from 'lucide-vue-next'
import { computed, onMounted, PropType, ref, watch } from 'vue'
import FlowIcon from '../../assets/flow.svg?component'
import TriggerIcon from '../../assets/trigger.svg?component'
import Dialog from '../composables/dialog'
import Agent from '../models/agent'
import { t } from '../services/i18n'
import { extractPromptInputs, extractAllWorkflowInputs } from '../services/prompt'
import { store } from '../services/store'
import EditorGeneral from './Editor.General.vue'
import EditorInvocation from './Editor.Invocation.vue'
import EditorModel from './Editor.Model.vue'
import EditorSettings from './Editor.Settings.vue'
import EditorWorkflow from './Editor.Workflow.vue'

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

const stepGeneral = ref<typeof EditorGeneral>(null)
const stepModel = ref<typeof EditorModel>(null)
const stepSettings = ref<typeof EditorSettings>(null)
const stepWorkflow = ref<typeof EditorWorkflow>(null)
const stepInvocation = ref<typeof EditorInvocation>(null)

const kStepGeneral = 'general'
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

  // edit mode
  return [
    kStepGeneral,
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

})

const stepIndex = (step: string) => {
  return steps().indexOf(step)
}

const hasStep = (step: string) => {
  return stepIndex(step) >= 0
}

const isStepCompleted = (step: string) => {
  return stepIndex(step) <= completedStep.value
}

const isStepVisible = (step: string) => {
  return stepIndex(step) === currentStep.value
}

const onNextStep = () => {
  if (currentStep.value == stepIndex(kStepGeneral)) {
    validateInformation()
  } else if (currentStep.value == stepIndex(kStepModel)) {
    validateModel()
  } else if (currentStep.value == stepIndex(kStepSettings)) {
    validateSettings()
  } else if (currentStep.value == stepIndex(kStepWorkflow)) {
    validateWorkflow()
  } else if (currentStep.value == stepIndex(kStepInvocation)) {
    validateInvocation()
  }
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
  if (isStepCompleted(step)) {
    currentStep.value = stepIndex(step)
  }
}

const goToStepAfter = (step: string, stepSize: number = 1) => {
  informationError.value = ''
  const currentIndex = stepIndex(step)
  currentStep.value = currentIndex + stepSize
  completedStep.value = Math.max(completedStep.value, currentIndex)
}

const validateInformation = () => {
  const error = stepGeneral.value?.validate()
  if (error) {
    informationError.value = error
    return
  }
  goToStepAfter(kStepGeneral)
}

const validateModel = () => {
  const error = stepModel.value?.validate()
  if (error) {
    informationError.value = error
    return
  }
  goToStepAfter(kStepModel, hasSettings.value ? 2 : 1)
}

const validateSettings = () => {
  const error = stepSettings.value?.validate()
  if (error) {
    informationError.value = error
    return
  }
  goToStepAfter(kStepSettings)
}

const validateWorkflow = () => {
  const error = stepWorkflow.value?.validate()
  if (error) {
    informationError.value = error
    return
  }
  goToStepAfter(kStepWorkflow)
}

const validateInvocation = () => {
  const error = stepInvocation.value?.validate()
  if (error) {
    informationError.value = error
    return
  }
  save()
}

const resetWizard = () => {
  // Start from the first step in the steps array
  const allSteps = steps()
  currentStep.value = allSteps.length > 0 ? stepIndex(allSteps[0]) : 0
  completedStep.value = props.mode === 'edit' ? steps().length - 1 : -1
  expandedStep.value = (props.mode === 'edit' && agent.value.steps.length > 1) ? -1 : 0
  informationError.value = ''
}

const save = async () => {

  if (agent.value.schedule || agent.value.webhookToken) {
    const inputs = extractAllWorkflowInputs(agent.value.steps)
    for (const input of inputs) {
      const value = agent.value.invocationValues[input.name]
      if (value === undefined || !value.trim()) {

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
        break
      }
    }
  }

  // we can save
  const rc = window.api.agents.save(store.config.workspaceId, JSON.parse(JSON.stringify(agent.value)))
  if (rc) {
    emit('save', agent.value)
  }
}

</script>


<style scoped>

.agent-editor {

  display: flex;
  flex-direction: column;
  background-color: var(--background-color-light);
  overflow: hidden;

  &:deep {
    input:not([type=checkbox]):not([type=range]), textarea, select {
      background-color: var(--background-color) !important;
    }
  }

  header {
    position: sticky;
    button {
      padding: 0.5rem 0.75rem;
      font-weight: var(--font-weight-medium);
    }
  }

  main {

    .wizard {

      &:deep() {

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
