<template>

  <ContextMenuPlus 
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    @close="$emit('close')"
  >

    <!-- 
        For an unknown reason with we want to display #tools as #default 
        Then then mcp menu is not initialized properly (no sub-menu)
        Filter and Footer do not work so yeah a mess
        Hence the click on this element onMounted so that we skip it
        and go to #tools slot. Not sure why this is necessary.
        Not elegant, but it works.
    -->

    <template #default>
      <div data-submenu-slot="tools">
        hello
      </div>
    </template>

    <template #tools="{ withFilter }">
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

    <template #toolsFooter>
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
import { nextTick, onMounted, ref, watch } from 'vue'
import * as ts from '../composables/tool_selection'
import { t } from '../services/i18n'
import type { ToolSelection } from '../types/llm'
import type { McpServer, McpServerWithTools, McpTool, McpToolUnique } from '../types/mcp'
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
  selectAllTools: []
  unselectAllTools: []
  selectAllPlugins: []
  unselectAllPlugins: []
  selectAllServerTools: [server: McpServerWithTools]
  unselectAllServerTools: [server: McpServerWithTools]
  allPluginsToggle: []
  pluginToggle: [pluginName: string]
  allServerToolsToggle: [server: McpServerWithTools]
  serverToolToggle: [server: McpServerWithTools, tool: McpTool]
}

const emit = defineEmits<Emits>()

// Reactive data
const allPluginsTools = ref<ToolSelection>([])
const mcpServersWithTools = ref<McpServerWithTools[]>([])
const pluginsStatusComputed = ref<ts.ToolStatus>('all')

onMounted(async () => {
  allPluginsTools.value = await ts.allPluginsTools()
  mcpServersWithTools.value = await window.api.mcp.getAllServersWithTools()

  watch(() => props, async () => {
    pluginsStatusComputed.value = await ts.pluginsStatus(props.toolSelection)
  }, { deep: true, immediate: true })

  await nextTick()
  document.querySelector<HTMLElement>('[data-submenu-slot="tools"]')?.click()

})

const pluginStatus = (pluginName: string): ts.ToolStatus => {
  return ts.pluginStatus(props.toolSelection, pluginName)
}

const serverToolsStatus = (server: McpServerWithTools): ts.ToolStatus => {
  return ts.serverToolsStatus(mcpServersWithTools.value, props.toolSelection, server)
}

const serverToolStatus = (server: McpServerWithTools, tool: McpToolUnique): ts.ToolStatus => {
  return ts.serverToolStatus(mcpServersWithTools.value, props.toolSelection, server, tool)
}

const getServerDisplayName = (server: McpServer): string => {
  return server.label || server.command || server.url || 'Unknown Server'
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

</script>

<style>
.context-menu:has(.plugin-group) .back-button {
  visibility: hidden;
  flex-basis: 1rem;
}
</style>

<style scoped>


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
