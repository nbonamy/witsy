
import { anyDict } from 'types/index'
import { PluginConfig } from './plugin'
import { MultiToolPlugin, LlmTool } from 'multi-llm-ts'

export default class extends MultiToolPlugin {

  config: PluginConfig
  tools: LlmTool[]
  
  constructor(config: PluginConfig) {
    super()
    this.config = config
    this.tools = []
  }

  isEnabled(): boolean {
    return /*this.config?.enabled && */window.api.mcp.isAvailable()
  }

  getName(): string {
    return 'Model Context Protocol'
  }

  getPreparationDescription(name: string): string {
    const tool = window.api.mcp.originalToolName(name)
    return `Preparing to use MCP tool ${tool}…`
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRunningDescription(name: string, args: any): string {
    const tool = window.api.mcp.originalToolName(name)
    return `MCP tool ${tool} is currently running…`
  }

  async getTools(): Promise<any> {
    try {
      this.tools = await window.api.mcp.getTools()
      if (this.toolsEnabled) {
        return this.tools.filter((tool: any) => {
          return this.toolsEnabled.includes(tool.function.name)
        })
      } else {
        return this.tools
      }
    } catch (error) {
      console.error(error)
      this.tools = []
      return []
    }
  }

  handlesTool(name: string): boolean {
    const handled = this.tools.find((tool: any) => tool.function.name === name) !== undefined
    return handled && (!this.toolsEnabled || this.toolsEnabled.includes(name))
  }

  async execute(parameters: anyDict): Promise<anyDict> {

    // avoid unauthorized call
    if (!this.handlesTool(parameters.tool)) {
      return { error: `Tool ${parameters.tool} is not handled by this plugin or has been disabled` }
    }

    try {
      const result = await window.api.mcp.callTool(parameters.tool, parameters.parameters)
      if (Array.isArray(result.content) && result.content.length == 1 && result.content[0].text) {
        return { result: result.content[0].text }
      } else {
        return result
      }
    } catch (error) {
      console.error(error)
      return { error: error.message }
    }
  }

}
