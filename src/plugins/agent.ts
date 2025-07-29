
import { Agent, anyDict } from '../types/index'
import { Configuration } from '../types/config'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin from './plugin'
import { t } from '../services/i18n'
import { extractPromptInputs, replacePromptInputs } from '../services/prompt'
import Runner, { RunnerCompletionOpts } from '../services/runner'

const kStoreIdPrefix = 'storeId:'

export interface AgentStorage {
  store: (value: any) => Promise<string>
  retrieve: (key: string) => Promise<any>
}

export type AgentPluginOpts = RunnerCompletionOpts & {
  storeData?: boolean
  retrieveData?: boolean
}

export default class extends Plugin {

  declare config: Configuration
  engine: string
  model: string
  agent: Agent
  opts: AgentPluginOpts
  storage?: AgentStorage

  constructor(
    config: Configuration, agent: Agent,
    engine: string, model: string, opts?: Omit<AgentPluginOpts, 'ephemeral'|'engine'|'model'>,
    storage?: AgentStorage, 
  ) {
    super(config)
    this.agent = agent
    this.engine = engine
    this.model = model
    this.storage = storage
    this.opts = {
      ephemeral: false,
      engine: this.engine,
      model: this.model,
      storeData: true,
      retrieveData: true,
      ...opts,
    }
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return `agent_${this.agent.name.replace(/ /g, '_').toLowerCase()}`
  }

  getDescription(): string {
    return this.agent.description
  }

  getPreparationDescription(): string {
    if (this.agent.getPreparationDescription) {
      return this.agent.getPreparationDescription()
    } else {
      return t('plugins.agent.starting', { agent: this.agent.name })
    }
  }
      
  getRunningDescription(tool: string, args: any): string {
    if (this.agent.getRunningDescription) {
      return this.agent.getRunningDescription(args)
    } else {
      return t('plugins.agent.running', { agent: this.agent.name })
    }
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {

    // error
    if (results.status === 'error ') {
      if (this.agent.getErrorDescription) {
        return this.agent.getErrorDescription(args, results)
      } else {
        return t('plugins.agent.error', { agent: this.agent.name, error: results.error })
      }
    }

    // success
    if (this.agent.getCompletedDescription) {
      return this.agent.getCompletedDescription(args, results)
    } else {
      return t('plugins.agent.completed', { agent: this.agent.name })
    }
  }

  getParameters(): PluginParameter[] {

    // if we have a prompt...
    if (this.agent.prompt) {

      // if parameters are defined, we return them
      if (this.agent.parameters.length) {
        return this.agent.parameters
      }

      // else we try to extract inputs from the prompt
      const inputs = extractPromptInputs(this.agent.prompt)
      return inputs.map(input => ({
        name: input.name,
        type: 'string',
        description: input.description,
        required: true,
      }))

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

      // first check the parameters if they store id
      if (this.storage && this.opts.retrieveData) {
        for (const key of Object.keys(parameters)) {
          const value = parameters[key]
          if (Array.isArray(value)) {
            parameters[key] = await Promise.all(value.map(async (v) => {
              if (typeof v === 'string' && v.startsWith(kStoreIdPrefix)) {
                console.log(`Retrieving value from storage for agent ${this.agent.name}`, v)
                return await this.storage.retrieve(v.substring(kStoreIdPrefix.length))
              }
              return v
            }))
          } else if (typeof value === 'string' && value.startsWith(kStoreIdPrefix)) {
            console.log(`Retrieving value from storage for agent ${this.agent.name}`, value)
            parameters[key] = await this.storage.retrieve(value.substring(kStoreIdPrefix.length))
          }
        }
      }

      // we need to build the prompt
      const prompt = replacePromptInputs(this.agent.prompt || '', parameters)
      //console.log(`Running agent ${this.agent.name} with prompt:`, prompt)

      // now call the agent through the runner
      const runner = new Runner(this.config, this.agent)
      const run = await runner.run('workflow', prompt, this.opts)
      
      if (run.status === 'success') {

        // the result
        const result = run.messages[run.messages.length - 1]?.content || ''

        // if no storage, we return the result directly
        if (!this.storage || !this.opts.storeData) {
          return {
            status: run.status,
            result: result,
            runId: run.id,
          }
        }

        // else store
        const key = await this.storage.store(result)
        console.log(`Stored result for agent ${this.agent.name}`, key, result.substring(0, 100))
        return {
          status: run.status,
          storeId: `${kStoreIdPrefix}${key}`,
        }

      } else if (run.status === 'error') {
        return { status: 'error', error: run.error }
      }
    } catch (error) {
      return { status: 'error', error: error }
    }

  }

}
