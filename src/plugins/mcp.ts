
import { anyDict } from 'types/index'
import Plugin, { PluginConfig } from './plugin'
import { LlmTool } from 'multi-llm-ts'

export default class extends Plugin {

  tools: LlmTool[]
  
  constructor(config: PluginConfig) {
    super(config)
    this.tools = []
  }

  isEnabled(): boolean {
    return this.config?.enabled && window.api.mcp.isAvailable()
  }

  isMultiTool(): boolean {
    return true
  }

  getName(): string {
    return 'Model Context Protocol'
  }

  getPreparationDescription(name: string): string {
    const tool = window.api.mcp.originalToolName(name)
    return `Preparing to use MCP tool #${tool}#…`
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRunningDescription(name: string, args: any): string {
    const tool = window.api.mcp.originalToolName(name)
    return `MCP tool #${tool}# is currently running…`
  }

  async getTools(): Promise<anyDict|Array<anyDict>> {
    try {
      this.tools = await window.api.mcp.getTools()
      return this.tools
    } catch (error) {
      console.error(error)
      this.tools = []
      return []
    }
  }

  handlesTool(name: string): boolean {
    return this.tools.find((tool: any) => tool.function.name === name) !== undefined
  }

  async execute(parameters: anyDict): Promise<anyDict> {
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
