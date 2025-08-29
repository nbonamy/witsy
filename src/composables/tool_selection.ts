import { availablePlugins, PluginInstance } from '../plugins/plugins'
import { ToolSelection } from '../types/llm'
import { McpServerWithTools, McpToolUnique } from '../types/mcp'
import { store } from '../services/store'

export type ToolStatus = 'all' | 'some' | 'none'

export const pluginsStatus = async (toolSelection: ToolSelection): Promise<ToolStatus> => {
  if (toolSelection === undefined || toolSelection === null) return 'all'
  if (toolSelection.length === 0) return 'none'
  const allPluginNames = await allPluginsTools()
  const selectedPluginNames = toolSelection.filter(selection => allPluginNames.includes(selection))
  if (selectedPluginNames.length === 0) return 'none'
  if (selectedPluginNames.length === allPluginNames.length) return 'all'
  return 'some'
}

export const pluginStatus = (toolSelection: ToolSelection, pluginName: string): ToolStatus => {
  if (toolSelection === undefined || toolSelection === null) return 'all'
  if (toolSelection.length === 0) return 'none'
  return toolSelection.includes(pluginName) ? 'all' : 'none'
}

export const serverToolsStatus = (allServersWithTools: McpServerWithTools[], toolSelection: ToolSelection, server: McpServerWithTools): ToolStatus => {
  if (toolSelection === undefined || toolSelection === null) return 'all'
  if (toolSelection.length === 0) return 'none'
  const toolUuids = allServersWithTools.find(item => item.uuid === server.uuid).tools.map(tool => tool.uuid)
  const selectedToolNames = toolSelection.filter(selection => toolUuids.includes(selection) )
  if (selectedToolNames.length === 0) return 'none'
  if (selectedToolNames.length === toolUuids.length) return 'all'
  return 'some'
}

export const serverToolStatus = (allServersWithTools: McpServerWithTools[], toolSelection: ToolSelection, server: McpServerWithTools, tool: McpToolUnique): ToolStatus => {
  if (toolSelection === undefined || toolSelection === null) return 'all'
  if (toolSelection.length === 0) return 'none'
  return toolSelection.includes(tool.uuid) ? 'all' : 'none'
}

export const allPluginsTools = async (includeMcp: boolean = false): Promise<ToolSelection> => {
  const plugins: ToolSelection = []
  for (const pluginName in availablePlugins) {
    if (pluginName === 'mcp' && !includeMcp) continue
    const pluginClass = availablePlugins[pluginName]
    const plugin: PluginInstance = new pluginClass(store.config.plugins[pluginName])
      if (plugin.isEnabled()) {
      if ('getTools' in plugin) {
        const pluginTools = await plugin.getTools()
        for (const pluginTool of pluginTools) {
          plugins.push(pluginTool.function.name)
        }
      } else {
        plugins.push(plugin.getName())
      }
    }
  }
  return plugins
}

export const initToolSelectionWithAllTools = async (): Promise<ToolSelection> => {
  const tools: ToolSelection = []
  
  // Get all plugin tools (excluding MCP plugin)
  const pluginTools = await allPluginsTools(false)
  tools.push(...pluginTools)
  
  // Get all MCP server tools
  try {
    const serversWithTools = await window.api.mcp.getAllServersWithTools()
    for (const server of serversWithTools) {
      for (const tool of server.tools) {
        tools.push(tool.uuid)
      }
    }
  } catch (error) {
    console.error('Failed to load MCP server tools:', error)
  }
  
  return tools
}

export const validateToolSelection = async (toolSelection: ToolSelection): Promise<ToolSelection> => {
  if (toolSelection) {
    const allTools = await initToolSelectionWithAllTools()
    if (toolSelection.length == allTools.length && toolSelection.every(t => allTools.includes(t))) {
      toolSelection = null
    }
  }
  // console.log('Validated tool selection:', toolSelection)
  return toolSelection
}

export const handleAllPluginsToggle = async (toolSelection: ToolSelection): Promise<ToolSelection> => {

  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const allPlugins = await allPluginsTools()
  const allActive = allPlugins.every(t => toolSelection.includes(t))
  toolSelection = toolSelection.filter(t => !allPlugins.includes(t))
  if (!allActive) {
    toolSelection.push(...allPlugins)
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handlePluginToggle = async (toolSelection: ToolSelection, toolName: string): Promise<ToolSelection> => {

  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  if (toolSelection.includes(toolName)) {
    toolSelection = toolSelection.filter(t => t !== toolName)
  } else {
    toolSelection.push(toolName)
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handleAllServerToolsToggle = async (toolSelection: ToolSelection, server: McpServerWithTools): Promise<ToolSelection> => {
  
  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const allActive = server.tools.every(t => toolSelection.includes(t.uuid))
  toolSelection = toolSelection.filter(t => !server.tools.map(t => t.uuid).includes(t))
  if (!allActive) {
    toolSelection.push(...server.tools.map(t => t.uuid))
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handleServerToolToggle = async (toolSelection: ToolSelection, server: McpServerWithTools, tool: McpToolUnique): Promise<ToolSelection> => {

  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  if (toolSelection.includes(tool.uuid)) {
    toolSelection = toolSelection.filter(t => t !== tool.uuid)
  } else {
    toolSelection.push(tool.uuid)
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handleSelectAllTools = async (): Promise<ToolSelection> => {
  return null
}

export const handleUnselectAllTools = async (): Promise<ToolSelection> => {
  return []
}

export const handleSelectAllPlugins = async (toolSelection: ToolSelection): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    return null
  }

  const allPlugins = await allPluginsTools()
  for (const plugin of allPlugins) {
    if (!toolSelection.includes(plugin)) {
      toolSelection.push(plugin)
    }
  }
  
  // done
  return await validateToolSelection(toolSelection)

}

export const handleUnselectAllPlugins = async (toolSelection: ToolSelection): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const allPlugins = await allPluginsTools()
  toolSelection = toolSelection.filter(t => !allPlugins.includes(t))
  
  // done
  return await validateToolSelection(toolSelection)

}

export const handleSelectAllServerTools = async (toolSelection: ToolSelection, server: McpServerWithTools): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    return null
  }

  const serverToolUuids = server.tools.map(t => t.uuid)
  for (const uuid of serverToolUuids) {
    if (!toolSelection.includes(uuid)) {
      toolSelection.push(uuid)
    }
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handleUnselectAllServerTools = async (toolSelection: ToolSelection, server: McpServerWithTools): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const serverToolUuids = server.tools.map(t => t.uuid)
  toolSelection = toolSelection.filter(t => !serverToolUuids.includes(t))
  
  // done
  return await validateToolSelection(toolSelection)

}