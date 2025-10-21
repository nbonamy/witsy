import { availablePlugins, pluginToolName, pluginTools } from '../plugins/plugins'
import { store } from '../services/store'
import { ToolSelection } from '../types/llm'
import { McpServerWithTools, McpToolUnique } from '../types/mcp'

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

  const { name, multi } = pluginToolName(store.config, pluginName)

  if (multi) {
    // Multi-tool plugin: check if any tools with this prefix are selected
    return toolSelection.some(t => t.startsWith(name)) ? 'all' : 'none'
  } else {
    // Single-tool plugin: check if the tool name is selected
    return toolSelection.includes(name) ? 'all' : 'none'
  }
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
    plugins.push(...await pluginTools(store.config, pluginName))
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

export const handlePluginToggle = async (toolSelection: ToolSelection, pluginName: string): Promise<ToolSelection> => {

  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const { name, multi } = pluginToolName(store.config, pluginName)

  if (multi) {
    // Multi-tool plugin: add/remove all tools with this prefix
    const pluginToolNames = await pluginTools(store.config, pluginName)
    const hasToolsSelected = toolSelection.some(t => t.startsWith(name))

    if (hasToolsSelected) {
      // Remove all tools with this prefix
      toolSelection = toolSelection.filter(t => !t.startsWith(name))
    } else {
      // Add all tools from this plugin
      for (const toolName of pluginToolNames) {
        if (!toolSelection.includes(toolName)) {
          toolSelection.push(toolName)
        }
      }
    }
  } else {
    // Single-tool plugin: toggle the single tool
    if (toolSelection.includes(name)) {
      toolSelection = toolSelection.filter(t => t !== name)
    } else {
      toolSelection.push(name)
    }
  }

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

export const handleSelectAllTools = async (visibleToolIds?: string[] | null): Promise<ToolSelection> => {
  if (visibleToolIds === null || !visibleToolIds) {
    // No filter active, select all tools
    return null
  }
  
  // Filter active, return only visible tools
  return visibleToolIds
}

export const handleUnselectAllTools = async (visibleToolIds?: string[] | null): Promise<ToolSelection> => {
  if (visibleToolIds === null || !visibleToolIds) {
    // No filter active, unselect all tools  
    return []
  }
  
  // Filter active, need to get current selection and remove only visible tools
  const allTools = await initToolSelectionWithAllTools()
  return allTools.filter(tool => !visibleToolIds.includes(tool))
}

export const handleSelectAllPlugins = async (toolSelection: ToolSelection, visiblePluginIds?: string[] | null): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    if (visiblePluginIds === null || !visiblePluginIds) {
      return null
    }
    // Filter active, start with all tools then add visible plugins
    toolSelection = await initToolSelectionWithAllTools()
  }

  const allPlugins = await allPluginsTools()
  const pluginsToAdd = visiblePluginIds === null || !visiblePluginIds 
    ? allPlugins 
    : []
  
  // If we have visible plugin IDs, get their tools
  if (visiblePluginIds && visiblePluginIds.length > 0) {
    for (const pluginName of visiblePluginIds) {
      if (availablePlugins[pluginName]) {
        const pluginToolsForName = await pluginTools(store.config, pluginName)
        pluginsToAdd.push(...pluginToolsForName)
      }
    }
  }
  
  for (const plugin of pluginsToAdd) {
    if (!toolSelection.includes(plugin)) {
      toolSelection.push(plugin)
    }
  }
  
  // done
  return await validateToolSelection(toolSelection)

}

export const handleUnselectAllPlugins = async (toolSelection: ToolSelection, visiblePluginIds?: string[] | null): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const allPlugins = await allPluginsTools()
  const pluginsToRemove = visiblePluginIds === null || !visiblePluginIds 
    ? allPlugins 
    : []
  
  // If we have visible plugin IDs, get their tools to remove
  if (visiblePluginIds && visiblePluginIds.length > 0) {
    for (const pluginName of visiblePluginIds) {
      if (availablePlugins[pluginName]) {
        const pluginToolsForName = await pluginTools(store.config, pluginName)
        pluginsToRemove.push(...pluginToolsForName)
      }
    }
  }
  
  toolSelection = toolSelection.filter(t => !pluginsToRemove.includes(t))
  
  // done
  return await validateToolSelection(toolSelection)

}

export const handleSelectAllServerTools = async (toolSelection: ToolSelection, server: McpServerWithTools, visibleToolIds?: string[] | null): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    if (visibleToolIds === null || !visibleToolIds) {
      return null
    }
    // Filter active, start with all tools
    toolSelection = await initToolSelectionWithAllTools()
  }

  const serverToolUuids = server.tools.map(t => t.uuid)
  const toolsToAdd = visibleToolIds === null || !visibleToolIds 
    ? serverToolUuids 
    : serverToolUuids.filter(uuid => visibleToolIds.includes(uuid))
  
  for (const uuid of toolsToAdd) {
    if (!toolSelection.includes(uuid)) {
      toolSelection.push(uuid)
    }
  }

  // done
  return await validateToolSelection(toolSelection)

}

export const handleUnselectAllServerTools = async (toolSelection: ToolSelection, server: McpServerWithTools, visibleToolIds?: string[] | null): Promise<ToolSelection> => {
  if (toolSelection === undefined || toolSelection === null) {
    toolSelection = await initToolSelectionWithAllTools()
  }

  const serverToolUuids = server.tools.map(t => t.uuid)
  const toolsToRemove = visibleToolIds === null || !visibleToolIds 
    ? serverToolUuids 
    : serverToolUuids.filter(uuid => visibleToolIds.includes(uuid))
  
  toolSelection = toolSelection.filter(t => !toolsToRemove.includes(t))
  
  // done
  return await validateToolSelection(toolSelection)

}