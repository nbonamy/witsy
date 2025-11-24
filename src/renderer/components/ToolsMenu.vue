<template>
  <ContextMenuPlus
    ref="contextMenuPlus"
    css-classes="tools-menu"
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="true"
    :hover-highlight="false"
    :items="menuItems"
    :footer-items="footerItems"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolsMenu } from '@composables/useToolsMenu'
import type { ToolSelection } from 'types/llm'
import type { McpServerWithTools, McpTool } from 'types/mcp'
import ContextMenuPlus from './ContextMenuPlus.vue'

// Props
interface Props {
  anchor: string
  position?: 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'
  teleport?: boolean
  toolSelection?: ToolSelection
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
})

// Emits
interface Emits {
  close: []
  selectAllTools: [visibleIds?: string[] | null]
  unselectAllTools: [visibleIds?: string[] | null]
  selectAllPlugins: [visibleIds?: string[] | null]
  unselectAllPlugins: [visibleIds?: string[] | null]
  selectAllServerTools: [server: McpServerWithTools, visibleIds?: string[] | null]
  unselectAllServerTools: [server: McpServerWithTools, visibleIds?: string[] | null]
  allPluginsToggle: []
  pluginToggle: [pluginName: string]
  allServerToolsToggle: [server: McpServerWithTools]
  serverToolToggle: [server: McpServerWithTools, tool: McpTool]
}

const emit = defineEmits<Emits>()

// Reactive data
const contextMenuPlus = ref()

// Use tools menu composable
const { menuItems, footerItems } = useToolsMenu({
  toolSelection: computed(() => props.toolSelection),
  contextMenuRef: contextMenuPlus,
  emit,
})

</script>

<style>
.context-menu.tools-menu:has(.plugin-group) .back-button {
  visibility: hidden;
  flex-basis: 1rem;
}
</style>
