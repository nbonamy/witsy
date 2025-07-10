
import { LlmModelOpts, PluginParameter } from 'multi-llm-ts'
import { anyDict, type Agent as AgentBase } from '../types/index'

export default class Agent implements AgentBase {

  id: string
  createdAt: number
  updatedAt: number
  name: string
  description: string
  primary: boolean
  engine: string
  model: string
  locale: string
  modelOpts: LlmModelOpts|null
  disableStreaming: boolean
  tools: string[]|null
  agents: string[]|null
  docrepo: string|null
  instructions: string
  prompt: string|null
  parameters: PluginParameter[]
  schedule: string|null

  constructor() {
    this.id = crypto.randomUUID()
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
    this.name = ''
    this.description = ''
    this.primary = true
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
    agent.createdAt = obj.createdAt ?? Date.now()
    agent.updatedAt = obj.updatedAt ?? Date.now()
    agent.name = obj.name
    agent.description = obj.description
    agent.primary = obj.primary ?? true
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
    agent.parameters = obj.parameters ?? []
    agent.schedule = obj.schedule ?? null
    agent.getPreparationDescription = preparationDescription
    agent.getRunningDescription = runningDescription
    agent.getCompletedDescription = completedDescription
    agent.getErrorDescription = errorDescription
    return agent
  }

  buildPrompt(parameters: anyDict): string|null {
    if (!this.prompt) return null
    let prompt = this.prompt
    for (const param of Object.keys(parameters)) {
      let value = parameters[param]
      if (Array.isArray(value)) {
        value = value.join(', ')
      }
      prompt = prompt.replace(new RegExp(`{{${param}}}`, 'g'), value)
    }
    return prompt
  }
  
  getPreparationDescription?: () => string
  getRunningDescription?: (args: any) => string
  getCompletedDescription?: (args: any, results: any) => string
  getErrorDescription?: (args: any, results: any) => string

}
