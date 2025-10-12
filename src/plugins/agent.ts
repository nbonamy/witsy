
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import { AgentA2AExecutorOpts } from '../services/agent_executor_a2a'
import { AgentWorkflowExecutorOpts } from '../services/agent_executor_workflow'
import { createAgentExecutor } from '../services/agent_utils'
import { t } from '../services/i18n'
import { extractPromptInputs, replacePromptInputs } from '../services/prompt'
import { Agent } from '../types/agents'
import { Configuration } from '../types/config'
import { anyDict } from '../types/index'
import Plugin from './plugin'

const kStoreIdPrefix = 'storeId:'

export interface AgentStorage {
  store: (value: any) => Promise<string>
  retrieve: (key: string) => Promise<any>
}

export type AgentPluginOpts = {
  workflowOpts?: AgentWorkflowExecutorOpts
  a2aOpts?: AgentA2AExecutorOpts
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
    config: Configuration, workspaceId: string, agent: Agent,
    engine: string, model: string, opts?: AgentPluginOpts,
    storage?: AgentStorage,
  ) {
    super(config, workspaceId)
    this.agent = agent
    this.engine = engine
    this.model = model
    this.storage = storage
    this.opts = {
      storeData: opts?.storeData ?? true,
      retrieveData: opts?.retrieveData ?? true,
      workflowOpts: {
        ephemeral: false,
        engine: this.engine,
        model: this.model,
        ...opts?.workflowOpts,
      },
      a2aOpts: {
        ephemeral: false,
        ...opts?.a2aOpts,
      },
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
    if (this.agent.steps[0].prompt) {

      // if parameters are defined, we return them
      if (this.agent.parameters.length) {
        return this.agent.parameters
      }

      // else we try to extract inputs from the prompt
      const inputs = extractPromptInputs(this.agent.steps[0].prompt)
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
                // console.log(`Retrieving value from storage for agent ${this.agent.name}`, v)
                return await this.storage.retrieve(v.substring(kStoreIdPrefix.length))
              }
              return v
            }))
          } else if (typeof value === 'string' && value.startsWith(kStoreIdPrefix)) {
            // console.log(`Retrieving value from storage for agent ${this.agent.name}`, value)
            parameters[key] = await this.storage.retrieve(value.substring(kStoreIdPrefix.length))
          }
        }
      }

      // we need to build the prompt
      const prompt = replacePromptInputs(this.agent.steps[0].prompt || '', parameters)
      //console.log(`Running agent ${this.agent.name} with prompt:`, prompt)

      // create executor and run with appropriate opts
      const executor = createAgentExecutor(this.config, this.workspaceId, this.agent)
      const executorOpts = this.agent.source === 'a2a' ? this.opts.a2aOpts : this.opts.workflowOpts
      const run = await executor.run('workflow', prompt, executorOpts)
      
      if (run.status === 'success') {

        // the result
        const result = run.messages[run.messages.length - 1]?.contentForModel || ''

        // if no storage, we return the result directly
        if (!this.storage || !this.opts.storeData) {
          return {
            status: run.status,
            result: result,
            runId: run.uuid,
          }
        }

        // else store
        const key = await this.storage.store(result)
        // console.log(`Stored result for agent ${this.agent.name}`, key, result.substring(0, 100))
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
