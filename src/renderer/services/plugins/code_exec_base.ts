
import { IPlugin, LlmEngine, MultiToolPlugin, PluginTool } from 'multi-llm-ts'
import LlmUtils from '../llm_utils'

export const kCodeExecutionPluginPrefix = 'code_exec_'

/**
 * Base class for code execution plugins.
 * Provides common functionality for plugin routing, schema management, and tool execution.
 * Extends MultiToolPlugin but is not meant to be instantiated directly - subclasses should implement the actual plugin functionality.
 */
export default class CodeExecutionBase extends MultiToolPlugin {

  protected plugins: IPlugin[] = []
  protected tools: PluginTool[] = []
  protected toolResultSchemas: Record<string, any> = {}

  constructor() {
    super()
    this.loadSchemas()
  }

  protected loadSchemas(): void {
    try {
      const codeExecData = window.api.codeExecution.load()
      if (codeExecData && codeExecData.schemas) {
        this.toolResultSchemas = codeExecData.schemas
      }
    } catch (error) {
      console.warn('[code_exec] Failed to load schemas:', error)
    }
  }

  protected saveSchemas(): void {
    try {
      let codeExecData = window.api.codeExecution.load()
      if (!codeExecData) codeExecData = { schemas: {} }
      codeExecData.schemas = this.toolResultSchemas
      window.api.codeExecution.save(codeExecData)
    } catch (error) {
      console.error('[code_exec] Failed to save schemas:', error)
    }
  }

  async install(engine: LlmEngine): Promise<void> {
    this.plugins = engine.plugins
    this.tools = await (engine as any).getAvailableTools()
    engine.clearPlugins()
    engine.addPlugin(this as any)
  }

  /**
   * Get schema for a tool from the schemas map, formatted as a string
   */
  protected getSchemaDescription(toolName: string): string {
    const schema = this.toolResultSchemas[toolName]
    if (schema) {
      return JSON.stringify(schema.schema)
    }
    return 'Schema not available'
  }

  /**
   * Extract error from a result object
   */
  protected getError(res: any): string | null {
    if (res.error) {
      return res.error
    }
    if (typeof res === 'string' && res.toLowerCase().startsWith('error')) {
      try {
        const parsed = LlmUtils.parseJson(res)
        if (parsed) {
          if (parsed.error) {
            return parsed.error
          } else if (parsed.message) {
            return parsed.message
          } else {
            return parsed
          }
        }
      } catch {
        return res
      }
      return res
    }
    return null
  }

  /**
   * Get the plugin that handles a specific tool name
   */
  protected getPluginForTool(tool: string): IPlugin | null {
    const plugin = this.plugins.find((plugin) => plugin.getName() === tool)
    if (plugin) {
      return plugin as IPlugin
    }

    // try multi-tools
    for (const plugin of Object.values(this.plugins)) {
      if (plugin instanceof MultiToolPlugin) {
        const multiToolPlugin = plugin as MultiToolPlugin
        if (multiToolPlugin.handlesTool(tool)) {
          return plugin
        }
      }
    }

    // not found
    return null
  }

  /**
   * Get information about available tools
   */
  protected getToolsInfo(toolNames: string[]): any {
    return {
      tools_info: toolNames.map((name: string) => {
        const foundTool = this.tools.find(t => t.name === name)
        if (!foundTool) {
          return {
            name,
            error: `Tool "${name}" not found`
          }
        }
        const toolInfo: any = {
          name: foundTool.name,
          description: foundTool.description,
          parameters: foundTool.parameters
        }
        // Add result_schema if available
        if (this.toolResultSchemas[name]) {
          toolInfo.result_schema = this.getSchemaDescription(name)
        }
        return toolInfo
      })
    }
  }

}
