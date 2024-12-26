
import { anyDict } from 'types/index'
import Plugin, { PluginConfig } from './plugin'

export default class extends Plugin {

  toolNames: string[]
  
  constructor(config: PluginConfig) {
    super(config)
    this.toolNames = []
  }

  isEnabled(): boolean {
    return this.config?.enabled && window.api.nestor.isAvailable()
  }

  isMultiTool(): boolean {
    return true
  }

  getName(): string {
    return 'Nestor'
  }

  async getTools(): Promise<anyDict|Array<anyDict>> {
    try {
      const tools = await window.api.nestor.getTools()
      this.toolNames = tools.map((tool: any) => tool.function.name)
      return tools
    } catch (error) {
      console.error(error)
      this.toolNames = []
      return []
    }
  }

  handlesTool(name: string): boolean {
    return this.toolNames.includes(name)
  }

  async execute(parameters: anyDict): Promise<anyDict> {
    try {
      return await window.api.nestor.callTool(parameters.tool, parameters.parameters)
    } catch (error) {
      console.error(error)
      return { error: error.message }
    }
  }

}
