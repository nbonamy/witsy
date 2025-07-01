
import Plugin from './plugin'
import BrowsePlugin from './browse'
import SearchPlugin from './search'
import PythonPlugin from './python'
import ImagePlugin from './image'
import VideoPlugin from './video'
import YouTubePlugin from './youtube'
import MemoryPlugin from './memory'
import McpPlugin from './mcp'
import FilesystemPlugin from './filesystem'
import { CustomToolPlugin, MultiToolPlugin } from 'multi-llm-ts'

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
