
import { anyDict } from 'types/index'
import BrowsePlugin from './browse'
import SearchPlugin from './search'
import PythonPlugin from './python'
import ImagePlugin from './image'
import VideoPlugin from './video'
import YouTubePlugin from './youtube'
import MemoryPlugin from './memory'
//import VegaPlugin from './vega'
import McpPlugin from './mcp'
//import NestorPlugin from './nestor'

export const availablePlugins: anyDict = {
  search: SearchPlugin,
  browse: BrowsePlugin, 
  image: ImagePlugin,
  video: VideoPlugin,
  mcp: McpPlugin,
  youtube: YouTubePlugin,
  python:  PythonPlugin,
  memory: MemoryPlugin,
  //vega: VegaPlugin,
  //nestor: NestorPlugin,
}
