<template>
  <ContextMenuPlus
    ref="contextMenuPlus"
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    :hover-highlight="false"
    :items="composedMenuItems"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import { BrainIcon, FeatherIcon, HammerIcon, LightbulbIcon, PaperclipIcon, TelescopeIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useDocReposMenu } from '../composables/useDocReposMenu'
import { useExpertsMenu } from '../composables/useExpertsMenu'
import { useInstructionsMenu } from '../composables/useInstructionsMenu'
import { useToolsMenu } from '../composables/useToolsMenu'
import { t } from '../services/i18n'
import { store } from '../services/store'
import type { MenuItem } from 'types/menu'
import { ToolSelection } from 'types/llm'
import { McpServerWithTools, McpTool } from 'types/mcp'
import ContextMenuPlus from './ContextMenuPlus.vue'

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
  selectAllTools: [visibleIds?: string[] | null]
  unselectAllTools: [visibleIds?: string[] | null]
  selectAllPlugins: [visibleIds?: string[] | null]
  unselectAllPlugins: [visibleIds?: string[] | null]
  allPluginsToggle: [],
  pluginToggle: [pluginName: string]
  selectAllServerTools: [server: McpServerWithTools, visibleIds?: string[] | null]
  unselectAllServerTools: [server: McpServerWithTools, visibleIds?: string[] | null]
  allServerToolsToggle: [server: McpServerWithTools]
  serverToolToggle: [server: McpServerWithTools, tool: McpTool]
  attachRequested: []
  deepResearchToggled: []
}

const emit = defineEmits<Emits>()

// Reactive data
const contextMenuPlus = ref()

// Use tools menu composable (only if tools enabled)
const toolsLogic = props.enableTools ? useToolsMenu({
  toolSelection: computed(() => props.toolSelection),
  contextMenuRef: contextMenuPlus,
  emit,
}) : null

// Use experts menu composable (only if experts enabled)
const expertsLogic = props.enableExperts ? useExpertsMenu({
  emit,
  footerMode: 'manage',
}) : null

// Use docrepos menu composable (only if docrepo enabled)
const docReposLogic = props.enableDocRepo ? useDocReposMenu({
  emit,
  footerMode: 'manage',
}) : null

// Use instructions menu composable (only if instructions enabled)
const instructionsLogic = props.enableInstructions ? useInstructionsMenu({
  emit,
}) : null


// Compose all menu items
const composedMenuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []

  // Instructions submenu (from composable)
  if (props.enableInstructions && instructionsLogic) {
    items.push({
      id: 'instructions',
      label: t('prompt.menu.instructions.title'),
      icon: FeatherIcon,
      submenu: instructionsLogic.menuItems.value,
      showFilter: instructionsLogic.showFilter,
      cssClass: 'instructions',
    })
  }

  // Tools submenu (from composable)
  if (props.enableTools && toolsLogic) {
    items.push({
      id: 'tools',
      label: t('prompt.menu.tools.title'),
      icon: HammerIcon,
      submenu: toolsLogic.menuItems.value,
      footer: toolsLogic.footerItems.value,
      showFilter: toolsLogic.showFilter, // Piloted by useToolsMenuItems
    })
  }

  // DocRepos submenu (from composable)
  if (props.enableDocRepo && docReposLogic) {
    items.push({
      id: 'docrepos',
      label: t('prompt.menu.docRepos.title'),
      icon: LightbulbIcon,
      submenu: docReposLogic.menuItems.value,
      footer: docReposLogic.footerItems.value,
      showFilter: docReposLogic.showFilter,
      cssClass: 'docrepos',
    })
  }

  // Experts submenu (from composable)
  if (props.enableExperts && expertsLogic && expertsLogic.menuItems.value.length > 0) {
    items.push({
      id: 'experts',
      label: t('prompt.menu.experts.title'),
      icon: BrainIcon,
      submenu: expertsLogic.menuItems.value,
      footer: expertsLogic.footerItems.value,
      showFilter: expertsLogic.showFilter,
      cssClass: 'experts',
    })
  }

  // Deep Research (simple item, no submenu)
  if (props.enableDeepResearch) {
    items.push({
      id: 'deepresearch',
      label: t('prompt.menu.deepResearch.title'),
      icon: TelescopeIcon,
      cssClass: 'deepresearch',
      onClick: () => {
        emit('deepResearchToggled')
        emit('close')
      },
    })
  }

  // Separator before attachments
  if (props.enableAttachments && (props.enableExperts || props.enableDocRepo || props.enableInstructions || props.enableDeepResearch)) {
    items.push({
      id: 'separator',
      type: 'separator',
    })
  }

  // Attachments (simple item, no submenu)
  if (props.enableAttachments) {
    items.push({
      id: 'attachments',
      label: t('prompt.menu.attach.title'),
      icon: PaperclipIcon,
      cssClass: 'attachments',
      onClick: () => {
        emit('attachRequested')
      },
    })
  }

  return items
})

</script>
