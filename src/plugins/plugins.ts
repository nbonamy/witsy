
import { anyDict } from 'types/index.d'
import BrowsePlugin from '../plugins/browse'
import TavilyPlugin from '../plugins/tavily'
import PythonPlugin from '../plugins/python'
import DallePlugin from '../plugins/dalle'
import NestorPlugin from '../plugins/nestor'

export const availablePlugins: anyDict = {
  browse: BrowsePlugin, 
  dalle: DallePlugin,
  python:  PythonPlugin,
  tavily: TavilyPlugin,
  nestor: NestorPlugin,
}
