
import { Agent, anyDict } from '../types/index'
import { Configuration } from '../types/config'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin from './plugin'
import { t } from '../services/i18n'
import Runner, { RunnerCompletionOpts } from '../services/runner'

export default class extends Plugin {

  declare config: Configuration
  engine: string
  model: string
  agent: Agent
  opts?: RunnerCompletionOpts

  constructor(config: Configuration, agent: Agent, engine: string, model: string, opts?: Omit<RunnerCompletionOpts, 'ephemeral'|'model'>) {
    super(config)
    this.agent = agent
    this.engine = engine
    this.model = model
    this.opts = {
      ephemeral: true,
      engine: this.engine,
      model: this.model,
      ...opts,
    }
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return `run_agent_${this.agent.name}`
  }

  getDescription(): string {
    return this.agent.description
  }

  getPreparationDescription(): string {
    return t('plugins.agent.starting', { agent: this.agent.name })
  }
      
  getRunningDescription(): string {
    return t('plugins.agent.running', { agent: this.agent.name })
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.agent.error', { agent: this.agent.name })
    } else {
      return t('plugins.agent.completed', { agent: this.agent.name })
    }
  }

  getParameters(): PluginParameter[] {
    
    if (this.agent.prompt) {

      return this.agent.parameters ?? []

    } else {

      return [
        {
          name: 'prompt',
          type: 'string',
          description: 'The prompt to send to the agent',
          required: true
        }
      ]

    }

  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    try {

      // we need to build the prompt
      const prompt = this.agent.buildPrompt(parameters) || parameters.prompt

      // now call the agent through the runner
      const runner = new Runner(this.config, this.agent)
      const run = await runner.run('workflow', prompt, this.opts)
      if (run.status === 'success') {
        return {
          status: run.status,
          result: run.messages[run.messages.length - 1]?.content || '',
          runId: run.id,
        }
      } else if (run.status === 'error') {
        return { error: run.error }
      }
    } catch (error) {
      return { error: error }
    }

  }

}
