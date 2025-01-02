
import { anyDict } from 'types/index'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'
import ImagePlugin from '../plugins/image'
import VideoPlugin from '../plugins/video'
import YouTubePlugin from '../plugins/youtube'
import MemoryPlugin from '../plugins/memory'
//import VegaPlugin from '../plugins/vega'
import NestorPlugin from '../plugins/nestor'

export const availablePlugins: anyDict = {
  image: ImagePlugin,
  video: VideoPlugin,
  browse: BrowsePlugin, 
  youtube: YouTubePlugin,
  tavily: TavilyPlugin,
  memory: MemoryPlugin,
  //vega: VegaPlugin,
  python:  PythonPlugin,
  nestor: NestorPlugin,
}
