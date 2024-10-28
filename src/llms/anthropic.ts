
import { store } from '../services/store'
import ComputerPlugin from '../plugins/computer'

const getComputerInfo = () =>{
  if (!window.api.computer.isAvailable()) return null
  const plugin = new ComputerPlugin(store.config.plugins.computer)
  return {
    plugin: plugin,
    screenSize: window.api.computer.getScaledScreenSize,
    screenNumber: window.api.computer.getScreenNumber,
  }
}

const isSpecializedModel = (model: string): boolean => {
  return model === 'computer-use'
}

const getFallbackModel = (): string => {
  return 'claude-3-5-sonnet-20241022'
}

export { getComputerInfo, isSpecializedModel, getFallbackModel }
