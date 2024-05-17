
import { anyDict } from '../types/index.d'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'

export const availablePlugins: anyDict = {
  browse: BrowsePlugin, 
  python:  PythonPlugin,
  tavily: TavilyPlugin,
}
