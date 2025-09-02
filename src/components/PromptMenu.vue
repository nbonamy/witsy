<template>
  <ContextMenuPlus 
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    @close="$emit('close')"
  >
    <!-- Main menu template -->
    <template #default>

      <div v-if="enableInstructions" class="instructions" data-submenu-slot="instructionsSubmenu" >
        <FeatherIcon class="icon" /> {{ t('prompt.menu.instructions.title') }}
      </div>

      <div v-if="enableTools" class="tools" data-submenu-slot="toolsSubmenu">
        <HammerIcon class="icon" /> {{ t('prompt.menu.tools.title') }}
      </div>
      
      <div v-if="enableDocRepo" class="docrepos" data-submenu-slot="docReposSubmenu" >
        <LightbulbIcon class="icon" /> {{ t('prompt.menu.docRepos.title') }}
      </div>
      
      <div v-if="enableExperts && expertsMenuItems.length > 0" class="experts" data-submenu-slot="expertsSubmenu" >
        <BrainIcon class="icon" /> {{ t('prompt.menu.experts.title') }}
      </div>
      
      <div v-if="enableDeepResearch" class="deepresearch" @click="handleDeepResearchClick" >
        <TelescopeIcon class="icon" /> {{ t('prompt.menu.deepResearch.title') }}
      </div>

      <div v-if="enableAttachments && (enableExperts || enableDocRepo || enableInstructions)" class="separator" >
        <hr>
      </div>
      
      <div v-if="enableAttachments" class="attachments" @click="handleAttachmentClick" >
        <PaperclipIcon class="icon" /> {{ t('prompt.menu.attach.title') }}
      </div>
      
    </template>

    <template #expertsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="expert in expertsMenuItems" :key="expert.id" @click="handleExpertClick(expert.id)" >
        <BrainIcon class="icon" /> {{ expert.name }}
      </div>
    </template>

    <!-- <template #expertsSubmenuFooter>
      <div @click="handleManageExperts">
        <PlusIcon class="icon" /> {{ t('prompt.menu.experts.manage') }}
      </div>
    </template> -->

    <template #docReposSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="docRepo in docReposMenuItems" :key="docRepo.uuid" @click="handleDocRepoClick(docRepo.uuid)" >
        <LightbulbIcon class="icon" /> {{ docRepo.name }}
      </div>
    </template>

    <template #docReposSubmenuFooter>
      <div @click="handleManageDocRepo">
        <SettingsIcon class="icon" /> {{ t('prompt.menu.docRepos.manage') }}
      </div>
    </template>

    <template #instructionsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div @click="handleInstructionsClick('null')" >
        {{ t('prompt.instructions.default') }}
      </div>
      <div v-for="instructionId in instructionIds" :key="instructionId" @click="handleInstructionsClick(instructionId)" >
        {{ t(`settings.llm.instructions.${instructionId}`) }}
      </div>
      <div v-for="custom in customInstructions" :key="custom.id" @click="handleInstructionsClick(`custom:${custom.id}`)" >
        {{ custom.label }}
      </div>
    </template>

    <template #toolsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div class="plugin-group" data-submenu-slot="pluginsSubMenu">
        <input type="checkbox" :checked="pluginsStatusComputed === 'all'" :data-indeterminate="pluginsStatusComputed === 'some'" @click.stop="handlePluginsClick()" />
        {{ t('prompt.menu.tools.plugins') }}
      </div>
      <template v-for="serverWithTools in mcpServersWithTools" :key="serverWithTools.uuid">
        <div v-if="serverWithTools.tools.length > 0" class="server-group" :data-submenu-slot="`tools-${serverWithTools.uuid}`">
          <input type="checkbox" :checked="serverToolsStatus(serverWithTools) === 'all'" :data-indeterminate="serverToolsStatus(serverWithTools) === 'some'" @click.stop="handleServerToolsClick(serverWithTools)" />
          {{ getServerDisplayName(serverWithTools) }}
        </div>
      </template>
    </template>

    <template #toolsSubmenuFooter>
      <div class="footer-select">
        <button @click="handleSelectAllTools()">
         {{  t('common.selectAll') }}
        </button>
        <button @click="handleUnselectAllTools()">
          {{  t('common.unselectAll') }}
        </button>
      </div>
    </template>

    <template #pluginsSubMenu="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="plugin in allPluginsTools" :key="plugin" @click="handlePluginClick(plugin)">
        <input type="checkbox" :checked="pluginStatus(plugin) === 'all'"  />
        {{ plugin }}
      </div>
    </template>

    <template #pluginsSubMenuFooter>
      <div class="footer-select">
        <button @click="handleSelectAllPlugins">
         {{  t('common.selectAll') }}
        </button>
        <button @click="handleUnselectAllPlugins">
          {{  t('common.unselectAll') }}
        </button>
      </div>
    </template>

    <template v-for="serverWithTools in mcpServersWithTools" :key="serverWithTools.uuid" v-slot:[`tools-${serverWithTools.uuid}`]="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="tool in serverWithTools.tools" :key="tool.name" @click.stop="handleServerToolClick(serverWithTools, tool)">
        <input type="checkbox" :checked="serverToolStatus(serverWithTools, tool) === 'all'"  />
        {{ tool.name }}
      </div>
    </template>

    <template v-for="serverWithTools in mcpServersWithTools" :key="serverWithTools.uuid" v-slot:[`tools-${serverWithTools.uuid}Footer`]="">
      <div class="footer-select">
        <button @click="handleSelectAllServerTools(serverWithTools)">
         {{  t('common.selectAll') }}
        </button>
        <button @click="handleUnselectAllServerTools(serverWithTools)">
          {{  t('common.unselectAll') }}
        </button>
      </div>
    </template>

</ContextMenuPlus>
</template>

<script setup lang="ts">
import { BrainIcon, FeatherIcon, HammerIcon, LightbulbIcon, PaperclipIcon, PlusIcon, SettingsIcon, TelescopeIcon } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import * as ts from '../composables/tool_selection'
import { expertI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { Expert } from '../types/index'
import { ToolSelection } from '../types/llm'
import { McpServer, McpServerWithTools, McpTool, McpToolUnique } from '../types/mcp'
import { DocumentBase } from '../types/rag'
import ContextMenuPlus from './ContextMenuPlus.vue'
import { server } from 'typescript'

// Props
interface Props {
  anchor: string
  position?: 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'
  teleport?: boolean
  enableExperts?: boolean
  enableDocRepo?: boolean
  enableInstructions?: boolean
  enableTools?: boolean
  enableAttachments?: boolean
  enableDeepResearch?: boolean
  toolSelection?: ToolSelection
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
  enableExperts: true,
  enableDocRepo: true,
  enableInstructions: true,
  enableTools: true,
  enableAttachments: true,
  enableDeepResearch: true,
})

// Emits
interface Emits {
  close: []
  expertSelected: [expertId: string]
  manageExperts: []
  docRepoSelected: [docRepoUuid: string]
  manageDocRepo: []
  instructionsSelected: [instructionId: string]
  selectAllTools: []
  unselectAllTools: []
  selectAllPlugins: []
  unselectAllPlugins: []
  allPluginsToggle: [],
  pluginToggle: [pluginName: string]
  selectAllServerTools: [server: McpServerWithTools]
  unselectAllServerTools: [server: McpServerWithTools]
  allServerToolsToggle: [server: McpServerWithTools]
  serverToolToggle: [server: McpServerWithTools, tool: McpTool]
  attachRequested: []
  deepResearchToggled: []
}

const emit = defineEmits<Emits>()

// Reactive data
const docRepos = ref<DocumentBase[]>([])
const allPluginsTools = ref<ToolSelection>([])
const mcpServersWithTools = ref<McpServerWithTools[]>([])
const pluginsStatusComputed = ref<ts.ToolStatus>('all')

// Built-in instruction IDs
const instructionIds = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']

const expertsMenuItems = computed(() => {
  return store.experts
    .filter((expert: Expert) => expert.state === 'enabled')
    .map(expert => ({
      id: expert.id,
      name: expert.name || expertI18n(expert, 'name'),
      prompt: expert.prompt || expertI18n(expert, 'prompt')
    }))
})

const docReposMenuItems = computed(() => {
  return docRepos.value.map(docRepo => ({
    uuid: docRepo.uuid,
    name: docRepo.name,
    description: (docRepo as any).description || ''
  }))
})

const customInstructions = computed(() => {
  return store.config.llm.customInstructions || []
})

onMounted(async () => {
  
  if (props.enableDocRepo) {
    loadDocRepos()
    window.api.on('docrepo-modified', loadDocRepos)
  }

  if (props.enableTools) {
    mcpServersWithTools.value = await window.api.mcp.getAllServersWithTools()
    allPluginsTools.value = await ts.allPluginsTools()

    watch(props, async () => {
      pluginsStatusComputed.value = await ts.pluginsStatus(props.toolSelection)
    }, { deep: true, immediate: true })

  }

})


const loadDocRepos = () => {
  try {
    docRepos.value = window.api?.docrepo?.list(store.config.workspaceId) || []
  } catch (error) {
    console.error('Failed to load document repositories:', error)
    docRepos.value = []
  }
}

const pluginStatus = (pluginName: string): ts.ToolStatus => {
  return ts.pluginStatus(props.toolSelection, pluginName)
}

const serverToolsStatus = (server: McpServerWithTools): ts.ToolStatus => {
  return ts.serverToolsStatus(mcpServersWithTools.value, props.toolSelection, server)
}

const serverToolStatus = (server: McpServerWithTools, tool: McpToolUnique): ts.ToolStatus => {
  return ts.serverToolStatus(mcpServersWithTools.value, props.toolSelection, server, tool)
}

const handleExpertClick = (expertId: string) => {
  emit('close')
  emit('expertSelected', expertId)
}

const handleManageExperts = () => {
  emit('close')
  emit('manageExperts')
}

const handleDocRepoClick = (docRepoUuid: string) => {
  emit('close')
  emit('docRepoSelected', docRepoUuid)
}

const handleManageDocRepo = () => {
  emit('close')
  emit('manageDocRepo')
}

const handleInstructionsClick = (instructionId: string) => {
  emit('instructionsSelected', instructionId)
  emit('close')
}

const handleSelectAllTools = () => {
  emit('selectAllTools')
}

const handleUnselectAllTools = () => {
  emit('unselectAllTools')
}

const handleSelectAllPlugins = () => {
  emit('selectAllPlugins')
}

const handleUnselectAllPlugins = () => {
  emit('unselectAllPlugins')
}

const handleSelectAllServerTools = (server: McpServerWithTools) => {
  emit('selectAllServerTools', server)
}

const handleUnselectAllServerTools = (server: McpServerWithTools) => {
  emit('unselectAllServerTools', server)
}

const handlePluginsClick = () => {
  emit('allPluginsToggle')
}

const handlePluginClick = (pluginName: string) => {
  emit('pluginToggle', pluginName)
}

const handleServerToolsClick = (server: McpServerWithTools) => {
  emit('allServerToolsToggle', server)
}

const handleServerToolClick = (server: McpServerWithTools, tool: McpTool) => {
  emit('serverToolToggle', server, tool)
}

const getServerDisplayName = (server: McpServer): string => {
  return server.label || server.command || server.url || 'Unknown Server'
}

const handleAttachmentClick = () => {
  emit('attachRequested')
}

const handleDeepResearchClick = () => {
  emit('deepResearchToggled')
  emit('close')
}

</script>

<style scoped>
.server-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-description {
  opacity: 0.7;
  font-size: 0.9em;
  margin-left: 8px;
}

.icon {
  width: 16px;
  height: 16px;
}

.footer-select {
  display: flex;
  align-items: center;
  button {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    svg {
      width: var(--icon-lg);
      height: var(--icon-lg);
    }
  }
}

</style>
