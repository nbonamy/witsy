
import { anyDict } from '../types/index'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { t } from '../services/i18n'

export const kPythonPluginName = 'run_python_code'

export default class extends Plugin {

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
  }

  isEnabled(): boolean {
    // Plugin is enabled if:
    // 1. enabled flag is true AND
    // 2. Either using embedded runtime OR has binpath for native runtime
    return this.config?.enabled && (this.config?.runtime === 'embedded' || this.config?.binpath != null)
  }

  getName(): string {
    return kPythonPluginName
  }

  getDescription(): string {
    if (this.config?.runtime === 'embedded') {
      return 'Execute Python code in a secure sandboxed environment (embedded runtime)'
    } else {
      return 'Execute Python code using native Python binary'
    }
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return t('plugins.python.running')
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.python.error', { error: results.error })
    } else {
      return t('plugins.python.completed', { result: results.result })
    }
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'script',
        type: 'string',
        description: 'The script to run',
        required: true
      }
    ]
  }

   
  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    // Route to appropriate runtime based on config
    const runtime = this.config?.runtime || 'embedded'

    let script = parameters.script
    let output: any

    if (runtime === 'embedded') {
      // Pyodide: Execute directly, returns value automatically
      output = await window.api.interpreter.pyodide(script)
    } else {
      // Native Python: Make sure last line is a print
      const lines = script.split('\n')
      const lastLine = lines[lines.length - 1]
      if (!lastLine.includes('print(')) {
        lines[lines.length - 1] = `print(${lastLine})`
        script = lines.join('\n')
      }
      output = await window.api.interpreter.python(script)
    }

    // Handle result
    if (output.error) {
      return output
    } else {
      // Native Python returns array, Pyodide returns string
      const result = Array.isArray(output.result) ? output.result.join('\n') : output.result
      return { result }
    }
  }  

}
