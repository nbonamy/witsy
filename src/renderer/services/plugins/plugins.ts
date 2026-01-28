
import { CustomToolPlugin, MultiToolPlugin } from 'multi-llm-ts'
import { Configuration } from 'types/config'
import { ToolSelection } from 'types/llm'
import BrowsePlugin from './browse'
import FilesystemPlugin from './filesystem'
import ImagePlugin from './image'
import KnowledgePlugin from './knowledge'
import McpPlugin from './mcp'
import MemoryPlugin from './memory'
import Plugin from './plugin'
import PythonPlugin from './python'
import SearchPlugin from './search'
import VideoPlugin from './video'
import YouTubePlugin from './youtube'

export type PluginInstance = Plugin | CustomToolPlugin | MultiToolPlugin
export type PluginType = {
  new (config: any, workspaceId: string): PluginInstance
}
export type PluginsList = Record<string, PluginType>

export const availablePlugins: PluginsList = {
  knowledge: KnowledgePlugin,
  search: SearchPlugin,
  browse: BrowsePlugin,
  image: ImagePlugin,
  video: VideoPlugin,
  mcp: McpPlugin,
  youtube: YouTubePlugin,
  python:  PythonPlugin,
  memory: MemoryPlugin,
  filesystem: FilesystemPlugin,
}

export const enabledPlugins = async (config: Configuration, includeMcp: boolean = false): Promise<string[]> => {
  const plugins: string[] = []
  for (const pluginName in availablePlugins) {
    if (pluginName === 'mcp' && !includeMcp) continue
    const pluginClass = availablePlugins[pluginName]
    const plugin: PluginInstance = new pluginClass(config.plugins[pluginName], config.workspaceId)
    if (plugin.isEnabled()) {
      // For MultiToolPlugins, check if they have actual tools available
      if ('getTools' in plugin) {
        const tools = await plugin.getTools()
        if (tools.length > 0) {
          plugins.push(pluginName)
        }
      } else {
        plugins.push(pluginName)
      }
    }
  }
  return plugins
}

export const pluginTools = async (config: Configuration, pluginName: string): Promise<ToolSelection> => {

  const plugins: ToolSelection = []
  const pluginClass = availablePlugins[pluginName]
  const plugin: PluginInstance = new pluginClass(config.plugins[pluginName], config.workspaceId)
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
  return plugins

}

export const pluginToolName = (config: Configuration, pluginName: string): { name: string, multi: boolean } => {
  const pluginClass = availablePlugins[pluginName]
  const plugin: PluginInstance = new pluginClass(config.plugins[pluginName], config.workspaceId)

  // Check if it's a multi-tool plugin with prefix
  if ('getToolNamePrefix' in plugin && typeof plugin.getToolNamePrefix === 'function') {
    return { name: plugin.getToolNamePrefix(), multi: true }
  }

  // Single-tool plugin
  if ('getTools' in plugin) {
    throw new Error('MultiToolPlugin without getToolNamePrefix is not supported')
  }
  return { name: plugin.getName(), multi: false }
}

