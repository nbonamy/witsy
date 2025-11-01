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
            <button class="docrepo" :id="`docrepo-menu-anchor-${index}`" :disabled="!docRepos.length" @click="onDocRepo(index)" :class="{ 'active': hasDocRepo(index) }"><LightbulbIcon /> {{ t('agent.create.workflow.docRepo') }}</button>
            <button class="tools" :id="`tools-menu-anchor-${index}`" @click="onTools(index)" :class="{ 'active': hasTools(index) }"><BlocksIcon /> {{ t('agent.create.workflow.customTools') }}</button>
            <button class="agents" :id="`agents-menu-anchor-${index}`" @click="onAgents(index)" :disabled="availableAgents.length === 0" :class="{ 'active': hasAgents(index) }"><AgentIcon /> {{ t('agent.create.workflow.customAgents') }}</button>
            <button class="expert" :id="`expert-menu-anchor-${index}`" @click="onExpert(index)" :class="{ 'active': hasExpert(index) }"><BrainIcon /> {{ t('agent.create.workflow.expert') }}</button>
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
  
  <!-- Doc Repo Context Menu -->
  <ContextMenuPlus 
    v-if="docRepoMenuVisible && docRepoMenuStepIndex >= 0" 
    :anchor="`#docrepo-menu-anchor-${docRepoMenuStepIndex}`"
    position="above"
    :hover-highlight="false"
    @close="onCloseDocRepoMenu"
  >
    <template #default>
      <div 
        v-for="repo in docRepos" 
        :key="repo.uuid"
        @click="selectDocRepo(repo.uuid)"
        :class="{ 'selected-repo': agent.steps[docRepoMenuStepIndex]?.docrepo === repo.uuid }"
      >
        <LightbulbIcon class="icon" />
        <span>{{ repo.name }}</span>
      </div>
    </template>
    <template #footer v-if="hasDocRepo(docRepoMenuStepIndex)">
      <div @click="selectDocRepo('none')">
        <Trash2Icon class="icon" />
        {{ t('common.clear') }}
      </div>
    </template>
  </ContextMenuPlus>
  
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

  <!-- Expert Context Menu -->
  <ContextMenuPlus
    v-if="expertMenuVisible && expertMenuStepIndex >= 0"
    :anchor="`#expert-menu-anchor-${expertMenuStepIndex}`"
    position="above"
    :hover-highlight="false"
    @close="onCloseExpertMenu"
  >
    <template #default="{ withFilter }">
      {{ withFilter(true) }}
      <!-- Categories with experts -->
      <div v-for="cat in categoriesWithExperts" :key="cat.id" :data-submenu-slot="`expertCategory-${cat.id}`">
        <FolderIcon class="icon" />
        <span>{{ cat.name }}</span>
      </div>

      <template v-if="uncategorizedExperts.length">
        <div v-for="exp in uncategorizedExperts" :key="exp.id" @click="selectExpert(exp.id)">
          <BrainIcon class="icon" />
          <span>{{ exp.name }}</span>
        </div>
      </template>
    </template>

    <!-- Category submenus for experts -->
    <template v-for="cat in categoriesWithExperts" :key="`submenu-${cat.id}`" #[`expertCategory-${cat.id}`]="">
      <div v-for="exp in expertsByCategory[cat.id]" :key="exp.id" @click="selectExpert(exp.id)">
        <BrainIcon class="icon" />
        <span>{{ exp.name }}</span>
      </div>
    </template>

    <template #footer v-if="hasExpert(expertMenuStepIndex)">
      <div @click="selectExpert(null)">
        <Trash2Icon class="icon" />
        {{ t('common.clear') }}
      </div>
    </template>

</ContextMenuPlus>
</template>

<script setup lang="ts">
import { BlocksIcon, BracesIcon, BrainIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon, LightbulbIcon, MousePointerClickIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, PropType, ref, watch } from 'vue'
import AgentIcon from '../../assets/agent.svg?component'
import ContextMenuPlus from '../components/ContextMenuPlus.vue'
import ToolsMenu from '../components/ToolsMenu.vue'
import WizardStep from '../components/WizardStep.vue'
import Dialog from '../composables/dialog'
import * as ts from '../composables/tool_selection'
import Agent from '../models/agent'
import AgentSelector from '../screens/AgentSelector.vue'
import { expertI18n, categoryI18n, t } from '../services/i18n'
import { extractPromptInputs } from '../services/prompt'
import { processJsonSchema } from '../services/schema'
import { store } from '../services/store'
import { kAgentStepVarFacts, kAgentStepVarOutputPrefix } from '../types/agents'
import { McpServerWithTools, McpToolUnique } from '../types/mcp'

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

// Watch for prop changes
watch(() => props.expandedStep, (newValue) => {
  expandedStep.value = newValue
})

// Computed properties for menus
const docRepos = computed(() => {
  return window.api.docrepo.list(store.config.workspaceId)
})

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

const selectDocRepo = (docRepoId: string) => {
  if (docRepoMenuStepIndex.value >= 0) {
    props.agent.steps[docRepoMenuStepIndex.value].docrepo = docRepoId === 'none' ? undefined : docRepoId
  }
  onCloseDocRepoMenu()
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

// Expert menu functionality
const expertsMenuItems = computed(() => {
  return store.experts
    .filter((e) => e.state === 'enabled')
    .map(e => ({
      id: e.id,
      name: e.name || expertI18n(e, 'name'),
      categoryId: e.categoryId
    }))
})

const categoriesWithExperts = computed(() => {
  const catIds = new Set<string>()
  expertsMenuItems.value.forEach(exp => {
    if (exp.categoryId) catIds.add(exp.categoryId)
  })

  const categories = store.expertCategories
    .filter(c => c.state === 'enabled' && catIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: categoryI18n(c, 'name')
    }))

  return categories.sort((a, b) => a.name.localeCompare(b.name))
})

const expertsByCategory = computed(() => {
  const grouped: Record<string, typeof expertsMenuItems.value> = {}
  expertsMenuItems.value.forEach(exp => {
    const catId = exp.categoryId || 'uncategorized'
    if (!grouped[catId]) grouped[catId] = []
    grouped[catId].push(exp)
  })
  return grouped
})

const uncategorizedExperts = computed(() => {
  return expertsMenuItems.value.filter(exp => !exp.categoryId)
})

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
  if (expertMenuStepIndex.value >= 0) {
    props.agent.steps[expertMenuStepIndex.value].expert = expertId || undefined
  }
  onCloseExpertMenu()
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
