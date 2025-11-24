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
              <div class="prompt">
                <div class="prompt-toolbar">
                  <ButtonIcon @click="onInsertSystemVariable(index)" :id="`system-var-anchor-${index}`"><BracesIcon />{{ t('agent.create.workflow.insertSystemVariable') }}</ButtonIcon>
                  <ButtonIcon @click="onCreateUserVariable(index)" :id="`plus-icon-${index}`"><PlusIcon />{{ t('agent.create.workflow.createUserVariable') }}</ButtonIcon>
                </div>
                <textarea v-model="agent.steps[index].prompt" name="prompt" :ref="(el: any) => setTextareaRef(el, index)"></textarea>
              </div>
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
            <button class="expert" :id="`expert-menu-anchor-${index}`" @click="onExpert(index)" :class="{ 'active': hasExpert(index) }"><BrainIcon /> {{ t('agent.create.workflow.expert') }}</button>
            <button class="docrepo" :id="`docrepo-menu-anchor-${index}`" @click="onDocRepo(index)" :class="{ 'active': hasDocRepo(index) }"><LightbulbIcon /> {{ t('agent.create.workflow.docRepo') }}</button>
            <button class="tools" :id="`tools-menu-anchor-${index}`" @click="onTools(index)" :class="{ 'active': hasTools(index) }"><BlocksIcon /> {{ t('agent.create.workflow.customTools') }}</button>
            <button class="agents" :id="`agents-menu-anchor-${index}`" @click="onAgents(index)" :disabled="availableAgents.length === 0" :class="{ 'active': hasAgents(index) }"><AgentIcon /> {{ t('agent.create.workflow.customAgents') }}</button>
            <button class="structured-output" @click="onStructuredOutput(index)" :class="{ 'active': hasJsonSchema(index) }"><BracesIcon /> {{ t('agent.create.workflow.jsonSchema') }}</button>
          </div>
        </div>
        <div class="step-footer">
          <div class="workflow-arrow" v-if="index < agent.steps.length - 1"></div>
          <button class="add-step tertiary" name="add-step" @click="onAddStep(index+1)"><PlusIcon /> {{ t('agent.create.workflow.addStep') }}</button>
        </div>
      </template>
    </template>
  </WizardStep>

  <ToolsMenu 
    v-if="toolsMenuVisible && toolsMenuStepIndex >= 0" 
    :anchor="`#tools-menu-anchor-${toolsMenuStepIndex}`"
    position="above"
    :tool-selection="toolsMenuStepIndex >= 0 ? agent.steps[toolsMenuStepIndex].tools : []"
    @close="onCloseToolsMenu"
    @select-all-tools="handleSelectAllTools"
    @unselect-all-tools="handleUnselectAllTools"
    @select-all-plugins="handleSelectAllPlugins"
    @unselect-all-plugins="handleUnselectAllPlugins"
    @select-all-server-tools="handleSelectAllServerTools"
    @unselect-all-server-tools="handleUnselectAllServerTools"
    @all-plugins-toggle="handleAllPluginsToggle"
    @plugin-toggle="handlePluginToggle"
    @all-server-tools-toggle="handleAllServerToolsToggle"
    @server-tool-toggle="handleServerToolToggle"
  />
  <AgentSelector ref="agentSelector" :exclude-agent-id="agent.uuid" @save="onSaveAgents" />

  <!-- Doc Repo Menu -->
  <DocReposMenu
    v-if="docRepoMenuVisible && docRepoMenuStepIndex >= 0"
    :anchor="`#docrepo-menu-anchor-${docRepoMenuStepIndex}`"
    position="above"
    :footer-mode="hasDocRepo(docRepoMenuStepIndex) ? 'clear' : 'none'"
    @close="onCloseDocRepoMenu"
    @doc-repo-selected="selectDocRepo"
    @manage-doc-repo="onManageDocRepo"
  />
  
  <!-- Agents Context Menu -->
  <ContextMenuPlus 
    v-if="agentsMenuVisible && agentsMenuStepIndex >= 0" 
    :anchor="`#agents-menu-anchor-${agentsMenuStepIndex}`"
    position="above"
    :hover-highlight="false"
    @close="onCloseAgentsMenu"
  >
    <template #default>
      <div v-for="availableAgent in availableAgents" :key="availableAgent.uuid" @click.stop="toggleAgent(availableAgent.uuid)" >
        <input type="checkbox" :checked="isAgentSelected(availableAgent.uuid)" />
        <AgentIcon class="icon" />
        <span>{{ availableAgent.name }}</span>
      </div>
    </template>
    <template #footer v-if="availableAgents.length > 0">
      <div class="footer-select">
        <button @click="selectAllAgents">
          {{ t('common.selectAll') }}
        </button>
        <button @click="clearAllAgents">
          {{ t('common.unselectAll') }}
        </button>
      </div>
    </template>
  </ContextMenuPlus>

  <!-- Expert Menu -->
  <ExpertsMenu
    v-if="expertMenuVisible && expertMenuStepIndex >= 0"
    :anchor="`#expert-menu-anchor-${expertMenuStepIndex}`"
    position="above"
    :footer-mode="hasExpert(expertMenuStepIndex) ? 'clear' : 'none'"
    @close="onCloseExpertMenu"
    @expert-selected="selectExpert"
    @manage-experts="onManageExperts"
  />

  <!-- System Variables Menu -->
  <ContextMenuPlus
    v-if="systemVarMenuVisible && systemVarMenuStepIndex >= 0"
    :anchor="`#system-var-anchor-${systemVarMenuStepIndex}`"
    position="below"
    @close="onCloseSystemVarMenu"
  >
    <template #default>
      <div @click.stop="insertPreviousStepOutput" :class="{ disabled: systemVarMenuStepIndex === 0 }" >
        <span>{{ t('agent.create.workflow.systemVar.previousStep') }}</span>
      </div>
    </template>
  </ContextMenuPlus>

  <!-- Create Variable Dialog -->
  <CreateUserVariable
    ref="createVariableDialog"
    @create="onVariableCreated"
  />
</template>

<script setup lang="ts">
import { BlocksIcon, BracesIcon, BrainIcon, ChevronDownIcon, ChevronRightIcon, LightbulbIcon, MousePointerClickIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, nextTick, PropType, ref, watch } from 'vue'
import AgentIcon from '@root/assets/agent.svg?component'
import Agent from '@models/agent'
import { kAgentStepVarFacts, kAgentStepVarOutputPrefix } from 'types/agents'
import { McpServerWithTools, McpToolUnique } from 'types/mcp'
import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import DocReposMenu from '@components/DocReposMenu.vue'
import ExpertsMenu from '@components/ExpertsMenu.vue'
import ToolsMenu from '@components/ToolsMenu.vue'
import WizardStep from '@components/WizardStep.vue'
import Dialog from '@renderer/utils/dialog'
import * as ts from '@renderer/utils/tool_selection'
import AgentSelector from '@screens/AgentSelector.vue'
import { t } from '@services/i18n'
import { extractPromptInputs } from '@services/prompt'
import { processJsonSchema } from '@services/schema'
import { store } from '@services/store'
import CreateUserVariable from './CreateUserVariable.vue'

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

const agentSelector = ref<typeof AgentSelector|null>(null)
const expandedStep = ref(props.expandedStep)
const toolsMenuVisible = ref(false)
const toolsMenuStepIndex = ref(-1)
const docRepoMenuVisible = ref(false)
const docRepoMenuStepIndex = ref(-1)
const agentsMenuVisible = ref(false)
const agentsMenuStepIndex = ref(-1)
const expertMenuVisible = ref(false)
const expertMenuStepIndex = ref(-1)

// Variable insertion refs
const textareaRefs = ref<Record<number, HTMLTextAreaElement>>({})
const caretPosition = ref<number>(0)
const activeStepIndex = ref<number>(-1)
const systemVarMenuVisible = ref(false)
const systemVarMenuStepIndex = ref(-1)
const createVariableDialog = ref(null)

// Watch for prop changes
watch(() => props.expandedStep, (newValue) => {
  expandedStep.value = newValue
})

// Computed properties for menus
const availableAgents = computed(() => {
  return store.agents.filter(a => a.uuid !== props.agent.uuid)
})

const hasDocRepo = (index: number) => {
  return !!props.agent.steps[index]?.docrepo
}

const hasTools = (index: number) => {
  return props.agent.steps[index]?.tools === null || (
    Array.isArray(props.agent.steps[index]?.tools) && props.agent.steps[index].tools.length > 0
  )
}

const hasAgents = (index: number) => {
  return props.agent.steps[index]?.agents && props.agent.steps[index].agents.length > 0
}

const hasExpert = (index: number) => {
  return !!props.agent.steps[index]?.expert
}

const hasJsonSchema = (index: number) => {
  return !!props.agent.steps[index]?.jsonSchema
}

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
    prompt: `{{${kAgentStepVarOutputPrefix}${index}}}`,
    tools: [],
    agents: [],
  })
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
}

const onDocRepo = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  docRepoMenuStepIndex.value = index
  docRepoMenuVisible.value = true
}

const onCloseDocRepoMenu = () => {
  docRepoMenuVisible.value = false
  docRepoMenuStepIndex.value = -1
}

const selectDocRepo = (docRepoId: string | null) => {
  const stepIndex = docRepoMenuStepIndex.value
  onCloseDocRepoMenu()

  if (stepIndex >= 0) {
    props.agent.steps[stepIndex].docrepo = docRepoId || undefined
  }
}

const onManageDocRepo = () => {
  onCloseDocRepoMenu()
  // DocReposMenu's manage button could open settings, but for now just close
  // TODO: Add navigation to docrepo settings if needed
}

const onTools = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  toolsMenuStepIndex.value = index
  toolsMenuVisible.value = true
}

const onCloseToolsMenu = () => {
  toolsMenuVisible.value = false
  toolsMenuStepIndex.value = -1
}

const handleSelectAllTools = async (visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleSelectAllTools(visibleIds)
  }
}

const handleUnselectAllTools = async (visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleUnselectAllTools(visibleIds)
  }
}

const handleSelectAllPlugins = async (visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleSelectAllPlugins(props.agent.steps[toolsMenuStepIndex.value].tools, visibleIds)
  }
}

const handleUnselectAllPlugins = async (visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleUnselectAllPlugins(props.agent.steps[toolsMenuStepIndex.value].tools, visibleIds)
  }
}

const handleSelectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleSelectAllServerTools(props.agent.steps[toolsMenuStepIndex.value].tools, server, visibleIds)
  }
}

const handleUnselectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleUnselectAllServerTools(props.agent.steps[toolsMenuStepIndex.value].tools, server, visibleIds)
  }
}

const handleAllPluginsToggle = async () => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleAllPluginsToggle(props.agent.steps[toolsMenuStepIndex.value].tools)
  }
}

const handlePluginToggle = async (pluginName: string) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handlePluginToggle(props.agent.steps[toolsMenuStepIndex.value].tools, pluginName)
  }
}

const handleAllServerToolsToggle = async (server: McpServerWithTools) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleAllServerToolsToggle(props.agent.steps[toolsMenuStepIndex.value].tools, server)
  }
}

const handleServerToolToggle = async (server: McpServerWithTools, tool: McpToolUnique) => {
  if (toolsMenuStepIndex.value >= 0) {
    props.agent.steps[toolsMenuStepIndex.value].tools = await ts.handleServerToolToggle(props.agent.steps[toolsMenuStepIndex.value].tools, server, tool)
  }
}

const onAgents = (index: number) => {
  if (availableAgents.value.length === 0) return
  
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  agentsMenuStepIndex.value = index
  agentsMenuVisible.value = true
}

const onCloseAgentsMenu = () => {
  agentsMenuVisible.value = false
  agentsMenuStepIndex.value = -1
}

const isAgentSelected = (agentId: string) => {
  if (agentsMenuStepIndex.value < 0) return false
  return props.agent.steps[agentsMenuStepIndex.value].agents?.includes(agentId) || false
}

const toggleAgent = (agentId: string) => {
  if (agentsMenuStepIndex.value < 0) return
  
  const currentAgents = props.agent.steps[agentsMenuStepIndex.value].agents || []
  const index = currentAgents.indexOf(agentId)
  
  if (index === -1) {
    props.agent.steps[agentsMenuStepIndex.value].agents = [...currentAgents, agentId]
  } else {
    props.agent.steps[agentsMenuStepIndex.value].agents = currentAgents.filter((id: string) => id !== agentId)
  }
}

const selectAllAgents = () => {
  if (agentsMenuStepIndex.value >= 0) {
    props.agent.steps[agentsMenuStepIndex.value].agents = availableAgents.value.map(agent => agent.uuid)
  }
}

const clearAllAgents = () => {
  if (agentsMenuStepIndex.value >= 0) {
    props.agent.steps[agentsMenuStepIndex.value].agents = []
  }
}

const onSaveAgents = (agents: string[]) => {
  props.agent.steps[expandedStep.value].agents = agents
}

const onExpert = (index: number) => {
  expandedStep.value = index
  emit('update:expanded-step', expandedStep.value)
  expertMenuStepIndex.value = index
  expertMenuVisible.value = true
}

const onCloseExpertMenu = () => {
  expertMenuVisible.value = false
  expertMenuStepIndex.value = -1
}

const selectExpert = (expertId: string | null) => {
  const stepIndex = expertMenuStepIndex.value
  onCloseExpertMenu()

  if (stepIndex >= 0) {
    props.agent.steps[stepIndex].expert = expertId || undefined
  }
}

const onManageExperts = () => {
  onCloseExpertMenu()
  // ExpertsMenu's manage button could open settings, but for now just close
  // TODO: Add navigation to experts settings if needed
}

const onStructuredOutput = async (index: number) => {
  
  const rc = await Dialog.show({
    title: t('agent.create.workflow.structuredOutput.title'),
    html: t('agent.create.workflow.structuredOutput.text'),
    customClass: { popup: 'x-large' },
    input: 'textarea',
    inputValue: props.agent.steps[index].jsonSchema,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: t('common.save'),
    denyButtonText: t('common.clear'),
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
  } else if (rc.isDenied) {
    // Clear the JSON schema
    props.agent.steps[index].jsonSchema = undefined
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

// Variable insertion helpers
const setTextareaRef = (el: HTMLTextAreaElement | null, index: number) => {
  if (el) {
    textareaRefs.value[index] = el
  }
}

const saveCaretPosition = (index: number) => {
  const textarea = textareaRefs.value[index]
  if (textarea) {
    caretPosition.value = textarea.selectionStart
    activeStepIndex.value = index
  }
}

const insertVariableAtCaret = (variableText: string) => {
  if (activeStepIndex.value < 0) return

  const stepIndex = activeStepIndex.value
  const prompt = props.agent.steps[stepIndex].prompt
  const beforeCaret = prompt.substring(0, caretPosition.value)
  const afterCaret = prompt.substring(caretPosition.value)

  props.agent.steps[stepIndex].prompt = beforeCaret + variableText + afterCaret

  // Restore focus and caret position after variable insertion
  const textarea = textareaRefs.value[stepIndex]
  if (textarea) {
    const newCaretPos = caretPosition.value + variableText.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCaretPos, newCaretPos)
    }, 0)
  }
}

const getExistingVariableNames = (index: number): string[] => {
  const prompt = props.agent.steps[index].prompt
  const regex = /\{\{([^:}]+)(?::[^:}]*)?(?::[^}]*)?\}\}/g
  const names: string[] = []
  let match
  while ((match = regex.exec(prompt)) !== null) {
    names.push(match[1])
  }
  return names
}

const onInsertSystemVariable = (index: number) => {
  saveCaretPosition(index)
  systemVarMenuStepIndex.value = index
  systemVarMenuVisible.value = true
}

const onCloseSystemVarMenu = () => {
  systemVarMenuVisible.value = false
  systemVarMenuStepIndex.value = -1
}

const insertSystemVariable = (variableName: string) => {
  onCloseSystemVarMenu()
  insertVariableAtCaret(`{{${variableName}}}`)
}

const insertPreviousStepOutput = async () => {

  if (systemVarMenuStepIndex.value === 0) return

  // For step 2 (index 1), directly insert step 1 output
  if (systemVarMenuStepIndex.value === 1) {
    insertSystemVariable(`${kAgentStepVarOutputPrefix}1`)
    return
  }

  systemVarMenuVisible.value = false
  await nextTick()

  // For step 3+ (index 2+), show dialog with all previous steps in reverse order
  const stepIndex = systemVarMenuStepIndex.value
  const inputOptions: Record<string, string> = {}

  // Build options in reverse order (most recent first)
  for (let i = 0; i <= stepIndex - 1; i++) {
    const stepNumber = i + 1
    const stepDescription = props.agent.steps[i].description || `Step ${stepNumber}`
    inputOptions[stepNumber.toString()] = `Step ${stepNumber} Output${stepDescription !== `Step ${stepNumber}` ? ` (${stepDescription})` : ''}`
  }

  const rc = await Dialog.show({
    title: t('agent.create.workflow.systemVar.previousStep'),
    text: 'Select which step output to insert:',
    input: 'select',
    inputOptions,
    inputValue: (stepIndex).toString(), // Default to most recent step
    showCancelButton: true,
    confirmButtonText: t('common.insert'),
  })

  if (rc.isConfirmed && rc.value) {
    insertSystemVariable(`${kAgentStepVarOutputPrefix}${rc.value}`)
  } else {
    onCloseSystemVarMenu()
  }
}

const onCreateUserVariable = (index: number) => {
  saveCaretPosition(index)
  const existingVars = getExistingVariableNames(index)
  createVariableDialog.value.show(existingVars)
}

const onVariableCreated = (variableData: { name: string, description: string, defaultValue: string }) => {
  const { name, description, defaultValue } = variableData
  let variableText = `{{${name}`
  if (description) {
    variableText += `:${description}`
    if (defaultValue) {
      variableText += `:${defaultValue}`
    }
  } else if (defaultValue) {
    variableText += `::${defaultValue}`
  }
  variableText += '}}'

  insertVariableAtCaret(variableText)
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
    font-size: 12.5px;
  }

  .prompt-inputs {
    
    margin: 0.5rem 0rem;

    th {
      font-weight: 600;
    }

    th, td {
      border: none;
      font-size: 12px;
      padding: 0.375rem 0.75rem;
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
            width: var(--icon-xl);
            height:var(--icon-xl);
            border-radius: 6px;
            background-color: var(--color-on-surface);
            svg {
              color: var(--color-on-primary);
              width: var(--icon-xl);
              height:var(--icon-xl);
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

        .prompt {
          width: 100%;
          position: relative;

          .prompt-toolbar {
            height: calc(2rem + 1px);
            background-color: var(--color-surface);
            border: 1px solid var(--border-color);  
            border-top-left-radius: 3px;
            border-top-right-radius: 3px;
            &:deep() .button-icon {
              font-size: var(--font-size-12);
            }
          }

          textarea {
            border-top: none;
            padding: 0.75rem;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
          }


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
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          
          &:hover {
            background-color: var(--color-surface);
          }
        }
        
        &.active {
          color: var(--color-primary);
          svg {
            color: var(--color-primary);
          }
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

.selected-repo {
  color: var(--color-primary);
}

</style>
