
import { anyDict } from '../types/index'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { t } from '../services/i18n'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled && this.config?.binpath != null
  }

  getName(): string {
    return 'run_python_code'
  }

  getDescription(): string {
    return 'Execute Python code and return the result'
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

    // make sure last line is a print
    let script = parameters.script
    const lines = script.split('\n')
    const lastLine = lines[lines.length - 1]
    if (!lastLine.includes('print(')) {
      lines[lines.length - 1] = `print(${lastLine})`
      script = lines.join('\n')
    }

    // now run it
    const output = window.api.interpreter.python(script)
    if (output.error) return output
    else return { result: output.result.join('\n') }
  }  

}
