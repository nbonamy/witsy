
import { IPlugin, LlmEngine, LlmTool, MultiToolPlugin, PluginExecutionContext } from 'multi-llm-ts'
import { t } from '../services/i18n'
import LlmUtils from '../services/llm_utils'
import { generateSimpleSchema } from '../services/schema'
import { anyDict } from '../types/index'

export const kCodeExecutionPluginPrefix = 'code_exec_'

class VariableResolutionError extends Error {
  constructor(toolName: string) {
    super(toolName)
  }
  get toolName(): string {
    return this.message
  }
}

export default class CodeExecutionPlugin extends MultiToolPlugin {

  private plugins: IPlugin[] = []
  private tools: LlmTool[] = []
  private toolResultSchemas: Record<string, any> = {}

  constructor() {
    super()
    this.loadSchemas()
  }

  isEnabled(): boolean {
    return true
  }

  private loadSchemas(): void {
    try {
      const codeExecData = window.api.codeExecution.load()
      if (codeExecData && codeExecData.schemas) {
        this.toolResultSchemas = codeExecData.schemas
      }
    } catch (error) {
      console.warn('[code_exec] Failed to load schemas:', error)
    }
  }

  private saveSchemas(): void {
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
    engine.addPlugin(this)
  }

  getName(): string {
    return 'execute_code'
  }

  getPreparationDescription(): string {
    return t('plugins.code_exec.preparing')
  }

  getRunningDescription(tool: string, args: anyDict): string {
    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      return t('plugins.code_exec.getToolsInfo.running', { count: args?.tools_names?.length })
    } else if (tool === `${kCodeExecutionPluginPrefix}run_program`) {
      return t('plugins.code_exec.runProgram.running', { count: args?.program?.steps?.length || 0 })
    }
  }

  getCompletedDescription(tool: string, args: anyDict, results: anyDict): string | undefined {
    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      if (results.error) {
        return t('plugins.code_exec.getToolsInfo.error', { error: results.error })
      }
      return t('plugins.code_exec.getToolsInfo.completed', { count: args?.tools_names?.length || 0 })
    } else if (tool === `${kCodeExecutionPluginPrefix}run_program`) {
      if (results.error) {
        return t('plugins.code_exec.runProgram.error', { error: results.error })
      }
      const stepCount = args?.program?.steps?.length || 0
      return t('plugins.code_exec.runProgram.completed', { count: stepCount })
    }
  }

  async getTools(): Promise<LlmTool[]> {
    return [
      {
        type: 'function' as const,
        function: {
          name: `${kCodeExecutionPluginPrefix}get_tools_info`,
          description: t('plugins.code_exec.getToolsInfo.description', { tools: this.tools.map((t) => `- ${t.function.name}`).join('\n') }),
          parameters: {
            type: 'object' as const,
            properties: {
              tools_names: {
                type: 'array',
                description: 'The name of the tools to get information about',
                items: { type: 'string' },
              }
            },
            required: ['tools_names']
          }
        }
      }, {
      type: 'function' as const,
      function: {
        name: `${kCodeExecutionPluginPrefix}run_program`,
        description: t('plugins.code_exec.runProgram.description'),
        parameters: {
          type: 'object',
          properties: {
            program: {
              type: 'object',
              description: 'The program to execute with a steps array. Each step has: id (string), tool (string), args (object with {{step_id.path}} for variable substitution)',
            }
          },
          required: ['program']
        }
      }
    }]
  }

  handlesTool(name: string): boolean {
    return name.startsWith(kCodeExecutionPluginPrefix)
  }

  private toString(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'object' || Array.isArray(value)) {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  /**
   * Parse template variables in the format {{step_id.path.to.value}}
   */
  private resolveVariables(value: any, results: Map<string, any>): any {
    if (typeof value === 'string') {
      // Find all {{variable}} patterns
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const resolved = this.resolvePath(path.trim(), results)
        return resolved !== undefined ? this.toString(resolved) : match
      })
    } else if (Array.isArray(value)) {
      return value.map(item => this.resolveVariables(item, results))
    } else if (value && typeof value === 'object') {
      const resolved: anyDict = {}
      for (const key in value) {
        resolved[key] = this.resolveVariables(value[key], results)
      }
      return resolved
    }
    return value
  }

  /**
   * Parse a path part that might contain bracket notation like "result[0]"
   * Returns { name: string, index: number | null }
   */
  private parseBracketNotation(part: string): { name: string, index: number | null } {
    const bracketMatch = part.match(/^([^[]+)\[(\d+)\]$/)
    if (bracketMatch) {
      return {
        name: bracketMatch[1],
        index: parseInt(bracketMatch[2], 10)
      }
    }
    return { name: part, index: null }
  }

  /**
   * Get schema for a tool from the schemas map, formatted as a string
   */
  private getSchemaDescription(toolName: string): string {
    const schema = this.toolResultSchemas[toolName]
    if (schema) {
      return JSON.stringify(schema.schema)
    }
    return 'Schema not available'
  }

  /**
   * Resolve a path like "step_id.result.data.0.gid" to the actual value
   */
  private resolvePath(path: string, results: Map<string, any>): any {
    
    const parts = path.split('.')
    const firstPart = parts[0]

    // Parse bracket notation in the step ID itself (e.g., "step1[0]")
    const parsedStepId = this.parseBracketNotation(firstPart)
    const stepId = parsedStepId.name
    const stepIndex = parsedStepId.index

    if (!results.has(stepId)) {
      throw new Error(`Step "${stepId}" has not been executed yet`)
    }

    // Get the step result wrapper and tool name for schema lookup
    const stepData = results.get(stepId)
    const toolName = stepData.tool

    // Check if we're accessing a metadata property (tool/args/result)
    // We need to parse bracket notation to check the property name without brackets
    const secondPartParsed = parts.length > 1 ? this.parseBracketNotation(parts[1]) : null
    const isMetadataAccess = secondPartParsed && ['tool', 'args', 'result'].includes(secondPartParsed.name)

    // Start with the result by default, unless accessing tool/args/result explicitly
    let value = stepData
    if (parts.length > 1 && !isMetadataAccess) {
      // Auto-unwrap to result for convenience
      value = stepData.result !== undefined ? stepData.result : stepData
    } else if (parts.length === 1 || stepIndex !== null) {
      // If just accessing the step (or step with index), unwrap to result
      value = stepData.result !== undefined ? stepData.result : stepData
    }

    // Handle bracket notation on the step ID itself
    if (stepIndex !== null) {
      if (!Array.isArray(value)) {
        throw new VariableResolutionError(toolName)
      }
      if (stepIndex >= value.length) {
        throw new VariableResolutionError(toolName)
      }
      value = value[stepIndex]
    }

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]

      if (value === null || value === undefined) {
        throw new VariableResolutionError(toolName)
      }

      // Parse bracket notation if present (e.g., "result[0]")
      const parsed = this.parseBracketNotation(part)

      // First, handle property/numeric access (without bracket)
      if (/^\d+$/.test(parsed.name)) {
        // Pure numeric access (dot notation like .0 or .5)
        if (Array.isArray(value)) {
          const index = parseInt(parsed.name, 10)
          if (index >= value.length) {
        throw new VariableResolutionError(toolName)
          }
          value = value[index]
        } else {
          throw new VariableResolutionError(toolName)
        }
      } else if (parsed.name) {
        // Property access
        if (typeof value === 'object' && !Array.isArray(value)) {
          if (!(parsed.name in value)) {
        throw new VariableResolutionError(toolName)
          }
          value = value[parsed.name]
        } else {
          throw new VariableResolutionError(toolName)
        }
      }

      // Then, handle bracket index if present (e.g., the [0] part of "result[0]")
      if (parsed.index !== null) {
        if (value === null || value === undefined) {
          throw new VariableResolutionError(toolName)
        }

        if (!Array.isArray(value)) {
          throw new VariableResolutionError(toolName)
        }

        if (parsed.index >= value.length) {
          throw new VariableResolutionError(toolName)
        }

        value = value[parsed.index]
      }
    }
    return value
  }

  getError(res: any) {
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

  async *executeWithUpdates(context: PluginExecutionContext, payload: any) {

    const { tool, parameters } = payload

    if (tool === `${kCodeExecutionPluginPrefix}get_tools_info`) {
      yield {
        type: 'result',
        result: {
          tools_info: parameters.tools_names.map((name: string) => {
          const foundTool = this.tools.find(t => t.function.name === name)
          if (!foundTool) {
            return {
              name,
              error: `Tool "${name}" not found`
            }
          }
          const toolInfo: any = {
            name: foundTool.function.name,
            description: foundTool.function.description,
            parameters: foundTool.function.parameters
          }
          // Add result_schema if available
          if (this.toolResultSchemas[name]) {
            toolInfo.result_schema = this.getSchemaDescription(name)
          }
          return toolInfo
        })
      }}
      return
    }

    if (tool !== `${kCodeExecutionPluginPrefix}run_program`) {
      yield {
        type: 'result',
        result: { error: `Tool "${tool}" not found` }
      }
      return
    }

    const steps = parameters.program?.steps ?? parameters.steps
    if (!steps || !Array.isArray(steps)) {
      yield {
        type: 'result',
        result: { error: 'Invalid program: must have a steps array' }
      }
      return
    }

    const results = new Map<string, any>()
    let finalResult: any = null

    for (const step of steps) {
      // Check abort before each step
      if (context.abortSignal?.aborted) {
        this.saveSchemas()
        yield {
          type: 'result',
          result: { error: 'Workflow cancelled' },
          canceled: true
        }
        return
      }

      // Yield status update: starting step
      yield {
        type: 'status',
        status: step.description || `Executing step ${step.id}: ${step.tool}`
      }

      try {
        
        // Resolve variables in args
        let resolvedArgs = {}
        try {
          resolvedArgs = this.resolveVariables(step.args, results)
        } catch (error: any) {
          if (error instanceof VariableResolutionError) {
            let errorMessage = `Failed to resolve variables in "${JSON.stringify(step.args)}" for step "${step.id}". `
            if (error.toolName && this.toolResultSchemas[error.toolName]) {
              errorMessage += `Expected schema for "${error.toolName}":\n${this.getSchemaDescription(error.toolName)}`
            } else {
              errorMessage += `Please check the argument structure and variable references.`
            }
            throw new Error(errorMessage)
          } else {
            throw error
          }
        }

        // Get the plugin for this tool
        const plugin = this.getPluginForTool(step.tool)
        if (!plugin) {
          const error = `Tool "${step.tool}" not found`
          this.saveSchemas()
          yield {
            type: 'status',
            status: `Failed step ${step.id}: ${error}`
          }
          yield {
            type: 'result',
            result: { error, failedStep: step.id }
          }
          return
        }

        // handle args for multi-tool plugins
        let toolArgs = resolvedArgs
        if (plugin instanceof MultiToolPlugin) {
          toolArgs = {
            tool: step.tool,
            parameters: resolvedArgs
          }
        }

        // Execute the tool
        const response = await plugin.execute(context, toolArgs)

        // hopefully JSON
        let result: any = response
        if (typeof response === 'object' && response !== null && 'result' in response) {
          result = response.result
        }
        if (typeof result === 'string') {
          try {
            result = JSON.parse(result)
          } catch {
            // Not JSON, keep as string
          }
        }

        // check error
        let err = this.getError(result)
        if (err) {
          this.saveSchemas()
          yield {
            type: 'status',
            status: `Failed step ${step.id}: ${err}`
          }
          yield {
            type: 'result',
            result: { error: err, failedStep: step.id }
          }
          return
        }

        // make it easier to access in later steps
        if (result.data) {
          result = result.data
        }

        // check error
        err = this.getError(result)
        if (err) {
          this.saveSchemas()
          yield {
            type: 'status',
            status: `Failed step ${step.id}: ${err}`
          }
          yield {
            type: 'result',
            result: { error: err, failedStep: step.id }
          }
          return
        }

        // Store result
        results.set(step.id, {
          tool: step.tool,
          args: resolvedArgs,
          result: result
        })
        finalResult = result

        // Generate and store schema for this tool's result
        try {
          const schema = generateSimpleSchema(result)
          if (!this.toolResultSchemas[step.tool]) {
            this.toolResultSchemas[step.tool] = {}
          }
          this.toolResultSchemas[step.tool].schema = schema
        } catch (schemaError) {
          // Silently fail schema generation - not critical
          console.warn(`Failed to generate schema for ${step.tool}:`, schemaError)
        }

        // Yield status update: completed step
        yield {
          type: 'status',
          status: `Completed step ${step.id}`
        }

      } catch (error: any) {
        const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Unknown error'
        this.saveSchemas()
        yield {
          type: 'status',
          status: `Failed step ${step.id}: ${errorMessage}`
        }
        yield {
          type: 'result',
          result: {
            error: errorMessage,
            failedStep: step.id
          }
        }
        return
      }
    }

    // Return final result
    this.saveSchemas()
    yield {
      type: 'result',
      result: finalResult
    }
  }

  /**
   * Fallback execute (non-streaming) - delegates to executeWithUpdates
   */
  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<any> {
    let lastResult: any = null
    for await (const update of this.executeWithUpdates(context, parameters)) {
      if (update.type === 'result') {
        lastResult = update.result
      }
    }
    return lastResult
  }

  protected getPluginForTool(tool: string): IPlugin|null {

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
}
