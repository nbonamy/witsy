
<template>
  <div class="form agent-editor form-large" @keydown.enter.prevent="onSave">

    <WizardStep :visible="isStepVisible(0)" :expanded="isStepExpanded(0)" :error="informationError" @click="onStepClick(0)" @next="validateInformation">
      <template #header>
        <label>{{ t('agent.create.information') }}</label>
      </template>
      <template #content>
        <div class="form-field">
          <label for="name">{{ t('agent.name') }}</label>
          <input type="text" v-model="agent.name" name="name" required />
        </div>
        <div class="form-field">
          <label for="description">{{ t('agent.description') }}</label>
          <textarea v-model="agent.description" name="description" rows="4" required></textarea>
        </div>
        <div class="form-field">
          <label for="goal">{{ t('agent.goal') }}</label>
          <textarea v-model="agent.instructions" name="goal" rows="4" required></textarea>
        </div>
      </template>
    </WizardStep>

    <WizardStep :visible="isStepVisible(1)" :expanded="isStepExpanded(1)" @click="onStepClick(1)" @next="validateModel">
      <template #header>
        <label>{{ t('agent.create.llm') }}</label>
      </template>
      <template #content>
        <div class="form-field">
          <label>{{ t('common.llmProvider') }}</label>
          <EngineSelect v-model="agent.engine" :default-text="t('agent.create.lastOneUsed')" @change="onChangeEngine"/>
        </div>
        <div class="form-field">
          <label>{{ t('common.llmModel') }}</label>
          <ModelSelect v-model="agent.model" :engine="agent.engine" :default-text="t('agent.create.lastOneUsed')" @change="onChangeModel"/>
        </div>
        <div class="form-field">
          <label>{{ t('modelSettings.locale') }}</label>
          <LangSelect name="locale" v-model="agent.locale" default-text="modelSettings.localeDefault" />
        </div>
      </template>
    </WizardStep>

    <WizardStep :visible="isStepVisible(2)" :expanded="isStepExpanded(2)" @click="onStepClick(2)" @next="validateSettings">
      <template #header>
        <label>{{ t('agent.create.settings') }}</label>
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

    <WizardStep :visible="isStepVisible(3)" :expanded="isStepExpanded(3)" @click="onStepClick(3)" @next="validateTools">
      <template #header>
        <label>{{ t('agent.create.tools.title') }}</label>
      </template>
      <template #content>
        <div class="form-field custom-tools">
          <input type="checkbox" v-model="customTools" @change="onCustomTools"/>
          {{ t('agent.create.tools.custom') }}
        </div>

        <div class="form-field custom-tools">
          <button class="all" @click.prevent="agent.tools = null">{{ t('agent.create.tools.selectAll') }}</button>
          <button class="none" @click.prevent="agent.tools = []">{{ t('agent.create.tools.selectNone') }}</button>
        </div>

        <div class="tools sticky-table-container">
          <table>
        <thead>
          <tr>
            <th>&nbsp;</th>
            <th>{{ t('agent.tools.name') }}</th>
            <th>{{ t('agent.tools.description') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tool in tools" :key="tool.id">
            <td class="enabled"><input type="checkbox" :disabled="!customTools" :checked="isToolActive(tool)" @click="toggleTool(tool)" /></td>
            <td>{{ tool.name }}</td>
            <td>{{ tool.description }}</td>
          </tr>
        </tbody>
          </table>
        </div>
      </template>
    </WizardStep>

    <WizardStep :visible="isStepVisible(4)" :expanded="isStepExpanded(4)" @click="onStepClick(4)" @next="validateInvocation">
      <template #header>
        <label>{{ t('agent.create.invocation') }}</label>
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

        <div class="form-field">
          <label for="prompt">{{ t('agent.prompt') }}</label>
          <textarea v-model="agent.prompt" name="prompt" rows="4"></textarea>
        </div>
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
</template>

<script setup lang="ts">

import { ref, onMounted, computed, watch, PropType } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { MultiToolPlugin } from 'multi-llm-ts'
import { CronExpressionParser } from 'cron-parser'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import Scheduler from '../components/Scheduler.vue'
import WizardStep from '../components/WizardStep.vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import { Plugin } from 'multi-llm-ts'
import Agent from '../models/agent'

type Tool = {
  id: string
  name: string
  description: string
  plugin: Plugin
}

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

const wizard = ref(null)
const agent = ref<Agent>(new Agent())
const tools = ref<Tool[]>([])
const customTools = ref(false)
const webhook = ref('')
const currentStep = ref(0)
const completedStep = ref(-1)
const informationError = ref('')

const isStepVisible = (step: number) => {
  return step <= completedStep.value + 1 || step === currentStep.value
}

const isStepExpanded = (step: number) => {
  return step === currentStep.value
}

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

const initTools = async () => {
  tools.value = []
  for (const pluginClass of Object.values(availablePlugins)) {
    const plugin = new pluginClass(store.config)
    if (plugin instanceof MultiToolPlugin) {

      const pluginTools = await plugin.getTools()
      for (const pluginTool of pluginTools) {
        tools.value.push({
          id: pluginTool.function.name,
          name: pluginTool.function.name,
          description: pluginTool.function.description,
          plugin
        })
      }

    } else {
      tools.value.push({
        id: plugin.getName(),
        name: plugin.getName(),
        description: plugin.getDescription(),
        plugin
      })
    }
  }
}

const onStepClick = (step: number) => {
  currentStep.value = step
}

const validateInformation = () => {
  if (!agent.value.name.trim().length ||
      !agent.value.description.trim().length ||
      !agent.value.instructions.trim().length) {
    informationError.value = t('common.required.fieldsRequired')
    return
  }
  currentStep.value = 1
  informationError.value = ''
  completedStep.value = Math.max(completedStep.value, 0)
}

const validateModel = () => {
  currentStep.value = 2
  completedStep.value = Math.max(completedStep.value, 1)
}

const validateSettings = () => {
  currentStep.value = 3
  completedStep.value = Math.max(completedStep.value, 2)
}

const validateTools = () => {
  currentStep.value = 4
  completedStep.value = Math.max(completedStep.value, 3)
}

const validateInvocation = () => {
  if ((agent.value.schedule || webhook.value) && !agent.value.prompt) {
    alert(t('agent.create.invocation.promptRequired'))
    return false
  }
  return true
}

const onChangeEngine = () => {
  agent.value.model = llmManager.getChatModel(agent.value.engine, agent.value.model).name
  onChangeModel()
}

const onChangeModel = () => {
}

const onCustomTools = () => {
  if (!customTools.value) {
    agent.value.tools = null
  }
}

const toggleTool = (tool: Tool) => {

  // if all tools enabled then fill
  if (!agent.value.tools) {
    agent.value.tools = tools.value.map(t => t.id)
  }

  // toggle the tool
  const index = agent.value.tools.findIndex(t => t === tool.id)
  if (index > -1) {
    agent.value.tools.splice(index, 1)
  } else {
    agent.value.tools.push(tool.id)
  }
}

const isToolActive = (tool: Tool) => {
  return !agent.value.tools || agent.value.tools.includes(tool.id)
}

onMounted(async () => {
  watch(() => props || {}, async () => {
    agent.value = props.agent ? JSON.parse(JSON.stringify(props.agent)) : new Agent()
    await initTools()
    if (wizard.value) {
      wizard.value.reset()
    }
  }, { deep: true, immediate: true })
})

const onCancel = () => {
  emit('cancel')
}

const save = async () => {
  if (validateInvocation()) {
    const rc = await window.api.agents.save(JSON.parse(JSON.stringify(agent.value)))
    if (rc) {
      emit('save', agent.value)
    }
  }
}

</script>


<style scoped>

.agent-editor {

  display: flex;
  flex-direction: column;

  &:deep() .vue-form-wizard .wizard-header {
    padding: 0px;
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;
    text-align: left;
    font-size: 11pt;
  }

  .form-field {
    align-items: baseline;
  }

  .sticky-table-container {
    max-height: 200px;
  }

  .custom-tools {
    margin-left: 0px;
    margin-bottom: 12px;
    input {
      margin-right: 4px;
    }
  }

}

</style>
