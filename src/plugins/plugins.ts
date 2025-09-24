
import { CustomToolPlugin, MultiToolPlugin } from 'multi-llm-ts'
import { Configuration } from '../types/config'
import { ToolSelection } from '../types/llm'
import BrowsePlugin from './browse'
import FilesystemPlugin from './filesystem'
import ImagePlugin from './image'
import McpPlugin from './mcp'
import MemoryPlugin from './memory'
import Plugin from './plugin'
import PythonPlugin from './python'
import SearchPlugin from './search'
import VideoPlugin from './video'
import YouTubePlugin from './youtube'

export type PluginInstance = Plugin | CustomToolPlugin | MultiToolPlugin
export type PluginType = typeof Plugin | typeof CustomToolPlugin | typeof MultiToolPlugin
export type PluginsList = Record<string, PluginType>

export const availablePlugins: PluginsList = {
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

export const enabledPlugins = (config: Configuration, includeMcp: boolean = false): string[] => {
  const plugins: string[] = []
  for (const pluginName in availablePlugins) {
    if (pluginName === 'mcp' && !includeMcp) continue
    const pluginClass = availablePlugins[pluginName]
    const plugin: PluginInstance = new pluginClass(config.plugins[pluginName])
    if (plugin.isEnabled()) {
      plugins.push(pluginName)
    }
  }
  return plugins
}

export const pluginTools = async (config: Configuration, pluginName: string): Promise<ToolSelection> => {

  const plugins: ToolSelection = []
  const pluginClass = availablePlugins[pluginName]
  const plugin: PluginInstance = new pluginClass(config.plugins[pluginName])
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

export const pluginToolName = (config: Configuration, pluginName: string): string => {
  const pluginClass = availablePlugins[pluginName]
  const plugin: PluginInstance = new pluginClass(config.plugins[pluginName])
  if ('getTools' in plugin) {
    throw new Error('this cannot be called with a CustomToolPlugin or MultiToolPlugin')
  }
  return plugin.getName()
}

