
import { LlmModelOpts, PluginParameter } from 'multi-llm-ts'
import { AgentSource, AgentType, type Agent as AgentBase } from '../types/index'
import { extractPromptInputs, replacePromptInputs } from '../services/prompt'
import { ZodType } from 'zod'

export default class Agent implements AgentBase {

  id: string
  source: AgentSource
  createdAt: number
  updatedAt: number
  name: string
  description: string
  type: AgentType
  engine: string
  model: string
  locale: string
  modelOpts: LlmModelOpts|null
  structuredOutput?: {
    name: string
    structure: ZodType
  }
  disableStreaming: boolean
  tools: string[]|null
  agents: string[]|null
  docrepo: string|null
  instructions: string
  prompt: string|null
  invocationValues: Record<string, string>
  parameters: PluginParameter[]
  schedule: string|null

  constructor() {
    this.id = crypto.randomUUID()
    this.source = 'witsy'
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
    this.name = ''
    this.description = ''
    this.type = 'runnable'
    this.engine = ''
    this.model = ''
    this.modelOpts = {}
    this.disableStreaming = true
    this.locale = ''
    this.tools = null
    this.agents = []
    this.docrepo = null
    this.instructions = ''
    this.prompt = null
    this.invocationValues = {}
    this.parameters = []
    this.schedule = null
  }

  static fromJson(
    obj: any,
    preparationDescription?: () => string,
    runningDescription?: (args: any) => string,
    completedDescription?: (args: any, results: any) => string,
    errorDescription?: (args: any, results: any) => string
  ): Agent {
    const agent = new Agent()
    agent.id = obj.id || crypto.randomUUID()
    agent.source = obj.source || 'witsy'
    agent.createdAt = obj.createdAt ?? Date.now()
    agent.updatedAt = obj.updatedAt ?? Date.now()
    agent.name = obj.name
    agent.description = obj.description
    agent.type = obj.type ?? 'runnable'
    agent.engine = obj.engine ?? ''
    agent.model = obj.model ?? ''
    agent.modelOpts = obj.modelOpts ?? null
    agent.disableStreaming = obj.disableStreaming ?? true
    agent.locale = obj.locale ?? ''
    agent.tools = obj.tools ?? null
    agent.agents = obj.agents ?? []
    agent.docrepo = obj.docrepo ?? null
    agent.instructions = obj.instructions ?? ''
    agent.prompt = obj.prompt ?? null
    agent.invocationValues = obj.invocationInputs ?? {}
    agent.parameters = obj.parameters ?? []
    agent.schedule = obj.schedule ?? null
    agent.getPreparationDescription = preparationDescription
    agent.getRunningDescription = runningDescription
    agent.getCompletedDescription = completedDescription
    agent.getErrorDescription = errorDescription
    return agent
  }

  buildPrompt(parameters: Record<string, any>): string|null {

    // need a prompt
    if (!this.prompt) return null

    // make sure we have the value for each
    const promptInputs = extractPromptInputs(this.prompt)
    for (const promptInput of promptInputs) {
      if (!parameters[promptInput.name]) {
        parameters[promptInput.name] = promptInput.defaultValue ?? ''
      }
    }

    return replacePromptInputs(this.prompt, parameters)

  }
  
  getPreparationDescription?: () => string
  getRunningDescription?: (args: any) => string
  getCompletedDescription?: (args: any, results: any) => string
  getErrorDescription?: (args: any, results: any) => string

}
