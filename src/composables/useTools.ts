import { Configuration } from '../types/config'
import { availablePlugins, PluginInstance } from '../plugins/plugins'
import { Plugin } from 'multi-llm-ts'
import McpPlugin from '../plugins/mcp'

export type Tool = {
  id: string
  name: string
  description: string
  plugin: Plugin
}

export type ToolCatalog = {
  builtInTools: Tool[]
  mcpTools: Tool[]
  allTools: Tool[]
}

export function useTools() {

  const getAllAvailableTools = async (config: Configuration): Promise<ToolCatalog> => {
    
    const builtInTools: Tool[] = []
    const mcpTools: Tool[] = []
    
    for (const pluginName in availablePlugins) {
      
      const pluginClass = availablePlugins[pluginName]
      const plugin: PluginInstance = new pluginClass(config.plugins[pluginName])
      if (!plugin.isEnabled()) continue
      
      if ('getTools' in plugin) {
        // Multi-tool plugin
        const pluginTools = await plugin.getTools()
        for (const pluginTool of pluginTools) {

          const id = pluginTool.function.name
          const name = plugin instanceof McpPlugin
            ? window.api.mcp.originalToolName(id)
            : id

          const tool: Tool = {
            id, 
            name,
            description: pluginTool.function.description,
            plugin
          }

          if (plugin instanceof McpPlugin) {
            mcpTools.push(tool)
          } else {
            builtInTools.push(tool)
          }
        }

      } else {
        // Single-tool plugin
        const tool: Tool = {
          id: plugin.getName(),
          name: plugin.getName(),
          description: plugin.getDescription(),
          plugin
        }
        builtInTools.push(tool)
      }
    }

    return {
      builtInTools,
      mcpTools,
      allTools: [...builtInTools, ...mcpTools]
    }
  }

  const getToolsForGeneration = async (config: Configuration): Promise<string> => {
    const catalog = await getAllAvailableTools(config)
    
    let toolsDescription = "Available Tools:\n\n"
    
    // Built-in tools section
    if (catalog.builtInTools.length > 0) {
      toolsDescription += "Built-in Tools:\n"
      for (const tool of catalog.builtInTools) {
        toolsDescription += `- ${tool.name}: ${tool.description}\n`
      }
      toolsDescription += "\n"
    }
    
    // MCP tools section
    if (catalog.mcpTools.length > 0) {
      // Group MCP tools by server
      const toolsByServer: Record<string, Tool[]> = {}
      for (const tool of catalog.mcpTools) {
        const serverName = tool.plugin.getName ? tool.plugin.getName() : 'MCP Server'
        if (!toolsByServer[serverName]) {
          toolsByServer[serverName] = []
        }
        toolsByServer[serverName].push(tool)
      }
      
      toolsDescription += "MCP Server Tools:\n"
      for (const [serverName, tools] of Object.entries(toolsByServer)) {
        const toolNames = tools.map(t => `${t.id} (${t.description})`).join(', ')
        toolsDescription += `- ${serverName}: ${toolNames}\n`
      }
      toolsDescription += "\n"
    }

    if (catalog.allTools.length === 0) {
      toolsDescription += "No tools are currently available.\n"
    }

    return toolsDescription
  }

  const getToolIds = (catalog: ToolCatalog): string[] => {
    return catalog.allTools.map(tool => tool.id)
  }

  return {
    getAllAvailableTools,
    getToolsForGeneration,
    getToolIds
  }
}