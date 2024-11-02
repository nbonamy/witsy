
import { anyDict } from 'types/index.d'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'
import ImagePlugin from '../plugins/image'
import NestorPlugin from '../plugins/nestor'

export const availablePlugins: anyDict = {
  image: ImagePlugin,
  browse: BrowsePlugin, 
  tavily: TavilyPlugin,
  python:  PythonPlugin,
  nestor: NestorPlugin,
}
