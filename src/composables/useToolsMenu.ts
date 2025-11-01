import { computed, onMounted, ref, watch, type Ref } from 'vue'
import * as ts from './tool_selection'
import { enabledPlugins } from '../plugins/plugins'
import { t } from '../services/i18n'
import { store } from '../services/store'
import type { MenuItem } from '../types/menu'
import type { ToolSelection } from '../types/llm'
import type { McpServer, McpServerWithTools, McpTool, McpToolUnique } from '../types/mcp'

export interface UseToolsMenuOptions {
  toolSelection: Ref<ToolSelection | undefined>
  contextMenuRef: Ref<any>
  emit: (event: any, ...args: any[]) => void
}

export function useToolsMenu(options: UseToolsMenuOptions) {
  const { toolSelection, contextMenuRef, emit } = options

  // Reactive data
  const allPluginsTools = ref<ToolSelection>([])
  const mcpServersWithTools = ref<McpServerWithTools[]>([])
  const pluginsStatusComputed = ref<ts.ToolStatus>('all')

  onMounted(async () => {
    allPluginsTools.value = await ts.allPluginsTools()
    mcpServersWithTools.value = await window.api.mcp.getAllServersWithTools()

    watch(() => toolSelection.value, async () => {
      pluginsStatusComputed.value = await ts.pluginsStatus(toolSelection.value)
    }, { deep: true, immediate: true })
  })

  // Status helpers
  const pluginStatus = (pluginName: string): ts.ToolStatus => {
    return ts.pluginStatus(toolSelection.value, pluginName)
  }

  const serverToolsStatus = (server: McpServerWithTools): ts.ToolStatus => {
    return ts.serverToolsStatus(mcpServersWithTools.value, toolSelection.value, server)
  }

  const serverToolStatus = (server: McpServerWithTools, tool: McpToolUnique): ts.ToolStatus => {
    return ts.serverToolStatus(mcpServersWithTools.value, toolSelection.value, server, tool)
  }

  const getServerDisplayName = (server: McpServer): string => {
    return server.label || server.command || server.url || 'Unknown Server'
  }

  // Event handlers
  const handleSelectAllTools = () => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('selectAllTools', visibleIds)
  }

  const handleUnselectAllTools = () => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('unselectAllTools', visibleIds)
  }

  const handleSelectAllPlugins = () => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('selectAllPlugins', visibleIds)
  }

  const handleUnselectAllPlugins = () => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('unselectAllPlugins', visibleIds)
  }

  const handleSelectAllServerTools = (server: McpServerWithTools) => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('selectAllServerTools', server, visibleIds)
  }

  const handleUnselectAllServerTools = (server: McpServerWithTools) => {
    const visibleIds = contextMenuRef.value?.getVisibleItemIds() || null
    emit('unselectAllServerTools', server, visibleIds)
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

  // Generate menu items
  const menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = []

    // Plugins submenu
    const pluginsSubmenu: MenuItem[] = enabledPlugins(store.config).map(plugin => ({
      id: plugin,
      label: t(`settings.plugins.${plugin}.title`),
      type: 'checkbox' as const,
      checked: pluginStatus(plugin) === 'all',
      onClick: () => handlePluginClick(plugin),
    }))

    items.push({
      id: 'plugins',
      label: t('prompt.menu.tools.plugins'),
      type: 'checkbox',
      checked: pluginsStatusComputed.value === 'all',
      indeterminate: pluginsStatusComputed.value === 'some',
      submenu: pluginsSubmenu,
      showFilter: true,
      footer: [
        {
          id: 'plugins-select-all',
          label: t('common.selectAll'),
          onClick: handleSelectAllPlugins,
        },
        {
          id: 'plugins-unselect-all',
          label: t('common.unselectAll'),
          onClick: handleUnselectAllPlugins,
        },
      ],
      onClick: handlePluginsClick,
      cssClass: 'plugin-group',
    })

    // MCP server tools submenus
    mcpServersWithTools.value.forEach(serverWithTools => {
      if (serverWithTools.tools.length === 0) return

      const serverToolsSubmenu: MenuItem[] = serverWithTools.tools.map(tool => ({
        id: tool.uuid,
        label: tool.name,
        type: 'checkbox' as const,
        checked: serverToolStatus(serverWithTools, tool) === 'all',
        onClick: () => handleServerToolClick(serverWithTools, tool),
      }))

      items.push({
        id: `server-${serverWithTools.uuid}`,
        label: getServerDisplayName(serverWithTools),
        type: 'checkbox',
        checked: serverToolsStatus(serverWithTools) === 'all',
        indeterminate: serverToolsStatus(serverWithTools) === 'some',
        submenu: serverToolsSubmenu,
        showFilter: true,
        footer: [
          {
            id: `server-${serverWithTools.uuid}-select-all`,
            label: t('common.selectAll'),
            onClick: () => handleSelectAllServerTools(serverWithTools),
          },
          {
            id: `server-${serverWithTools.uuid}-unselect-all`,
            label: t('common.unselectAll'),
            onClick: () => handleUnselectAllServerTools(serverWithTools),
          },
        ],
        onClick: () => handleServerToolsClick(serverWithTools),
        cssClass: 'server-group',
      })
    })

    return items
  })

  // Footer items for the main tools menu
  const footerItems = computed<MenuItem[]>(() => [
    {
      id: 'tools-select-all',
      label: t('common.selectAll'),
      onClick: handleSelectAllTools,
    },
    {
      id: 'tools-unselect-all',
      label: t('common.unselectAll'),
      onClick: handleUnselectAllTools,
    },
  ])

  return {
    // Menu structure
    menuItems,
    footerItems,
    showFilter: true,

    // Data
    allPluginsTools,
    mcpServersWithTools,
    pluginsStatusComputed,

    // Status helpers
    pluginStatus,
    serverToolsStatus,
    serverToolStatus,
    getServerDisplayName,

    // Event handlers
    handleSelectAllTools,
    handleUnselectAllTools,
    handleSelectAllPlugins,
    handleUnselectAllPlugins,
    handleSelectAllServerTools,
    handleUnselectAllServerTools,
    handlePluginsClick,
    handlePluginClick,
    handleServerToolsClick,
    handleServerToolClick,
  }
}
