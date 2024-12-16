
import { anyDict } from 'types/index.d'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'
import ImagePlugin from '../plugins/image'
import YouTubePlugin from '../plugins/youtube'
//import VegaPlugin from '../plugins/vega'
import NestorPlugin from '../plugins/nestor'

export const availablePlugins: anyDict = {
  image: ImagePlugin,
  browse: BrowsePlugin, 
  youtube: YouTubePlugin,
  tavily: TavilyPlugin,
  //vega: VegaPlugin,
  python:  PythonPlugin,
  nestor: NestorPlugin,
}
