
import { IPlugin, MultiToolPlugin, PluginExecutionContext, PluginTool } from 'multi-llm-ts'
import { anyDict } from 'types/index'
import { t } from '../i18n'
import CodeExecutionBase, { kCodeExecutionPluginPrefix } from './code_exec_base'

export const kCodeExecutionProxyPluginToolName = `${kCodeExecutionPluginPrefix}call_tool`

type ProxyArgs = {
  tools_names?: string[]
  tool_name?: string
  parameters?: anyDict
}

/**
 * Proxy code execution plugin that transparently forwards tool calls to underlying plugins.
 * Provides two tools:
 * - call_tool: Execute any available tool by name (pure passthrough)
 * - get_tools_info: Get information about available tools
 */
export default class CodeExecutionProxyPlugin extends CodeExecutionBase {

  constructor() {
    super()
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'execute_code_proxy'
  }

  getPreparationDescription(): string {
    return t('plugins.code_exec.callTool.preparing')
  }

  getRunningDescription(tool: string, args: ProxyArgs): string {
    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      return t('plugins.code_exec.getToolsInfo.running', { count: args?.tools_names?.length })
    } else if (tool === `${kCodeExecutionPluginPrefix}call_tool`) {
      const plugin = this.getPlugin(args.tool_name)
      if (plugin) {
        return plugin.getRunningDescription(args.tool_name, args.parameters)
      } else {
        return t('plugins.code_exec.callTool.running', { tool: args?.tool_name })
      }
    }
  }

  getCompletedDescription(tool: string, args: ProxyArgs, results: anyDict): string | undefined {
    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      if (results.error) {
        return t('plugins.code_exec.getToolsInfo.error', { error: results.error })
      }
      return t('plugins.code_exec.getToolsInfo.completed', { count: args?.tools_names?.length || 0 })
    }
    else if (tool === `${kCodeExecutionPluginPrefix}call_tool`) {
      const plugin = this.getPlugin(args.tool_name)
      if (plugin) {
        return plugin.getCompletedDescription(args.tool_name, args.parameters, results)
      } else if (results.error) {
        return t('plugins.code_exec.callTool.error', { error: results.error })
      } else {
        return t('plugins.code_exec.callTool.completed', { tool: args?.tool_name })
      }
    }
  }

  async getTools(): Promise<PluginTool[]> {
    const toolsList = this.tools.map((t) => `- ${t.name}`).join('\n')
    return [
      {
        name: `${kCodeExecutionPluginPrefix}call_tool`,
        description: t('plugins.code_exec.callTool.description', { tools: toolsList }),
        parameters: [
          { name: 'tool_name', type: 'string', description: 'The name of the tool to execute', required: true },
          { name: 'args', type: 'object', description: 'The arguments to pass to the tool', required: true },
        ]
      },
      {
        name: `${kCodeExecutionPluginPrefix}get_tools_info`,
        description: t('plugins.code_exec.getToolsInfo.description', { tools: toolsList }),
        parameters: [
          { name: 'tools_names', type: 'array', description: 'The name of the tools to get information about', required: true, items: { type: 'string' } },
        ]
      }
    ]
  }

  handlesTool(name: string): boolean {
    return name.startsWith(kCodeExecutionPluginPrefix)
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<any> {

    const tool: string = parameters.tool
    const args: ProxyArgs = parameters.parameters

    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      return this.getToolsInfo(args.tools_names)
    }

    if (tool === `${kCodeExecutionPluginPrefix}call_tool`) {
      if (!args.tool_name) {
        return { error: 'tool_name parameter is required' }
      }

      // Get the plugin for this tool
      const plugin = this.getPlugin(args.tool_name)
      if (!plugin) {
        return { error: `Tool "${args.tool_name}" not found` }
      }

      // Handle MultiToolPlugin wrapping
      let toolArgs = args.parameters || {}
      if (plugin instanceof MultiToolPlugin) {
        toolArgs = {
          tool: args.tool_name,
          parameters: toolArgs
        }
      }

      // Execute and return result as-is (pure passthrough)
      return await plugin.execute(context, toolArgs)
    }

    return { error: `Tool "${tool}" not found` }
  }

  protected getPlugin(toolName: string): IPlugin {
    return this.getPluginForTool(toolName)
  }

}
