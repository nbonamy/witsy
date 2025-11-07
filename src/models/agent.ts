
import { LlmModelOpts, PluginParameter } from 'multi-llm-ts'
import { Agent as AgentBase, AgentSource, AgentStep, AgentType } from '../types/agents'

export default class Agent implements AgentBase {

  uuid: string
  source: AgentSource
  createdAt: number
  updatedAt: number
  lastRunId?: string
  name: string
  description: string
  type: AgentType
  engine: string|null
  model: string|null
  modelOpts: LlmModelOpts|null
  disableStreaming: boolean
  locale: string
  instructions: string
  parameters: PluginParameter[]
  steps: AgentStep[] = []
  schedule: string|null
  webhookToken: string|null
  invocationValues: Record<string, string>

  constructor() {
    this.uuid = crypto.randomUUID()
    this.source = 'witsy'
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
    this.name = ''
    this.description = ''
    this.type = 'runnable'
    this.engine = ''
    this.model = ''
    this.disableStreaming = false
    this.modelOpts = {}
    this.locale = ''
    this.instructions = ''
    this.parameters = []
    this.schedule = null
    this.webhookToken = null
    this.invocationValues = {}
    this.steps = [{
      tools: [],
      agents: [],
    }]
  }

  static fromJson(
    obj: any,
    preparationDescription?: () => string,
    runningDescription?: (args: any) => string,
    completedDescription?: (args: any, results: any) => string,
    errorDescription?: (args: any, results: any) => string
  ): Agent {
    const agent = new Agent()
    agent.uuid = obj.uuid || crypto.randomUUID()
    agent.source = obj.source || 'witsy'
    agent.createdAt = obj.createdAt ?? Date.now()
    agent.updatedAt = obj.updatedAt ?? Date.now()
    agent.lastRunId = obj.lastRunId
    agent.name = obj.name
    agent.description = obj.description
    agent.type = obj.type ?? 'runnable'
    agent.engine = obj.engine ?? ''
    agent.model = obj.model ?? ''
    agent.modelOpts = obj.modelOpts ?? {}
    agent.disableStreaming = obj.disableStreaming ?? true
    agent.locale = obj.locale ?? ''
    agent.instructions = obj.instructions ?? ''
    agent.parameters = obj.parameters ?? []
    agent.steps = obj.steps ?? []
    agent.schedule = obj.schedule ?? null
    agent.webhookToken = obj.webhookToken ?? null
    agent.invocationValues = obj.invocationValues ?? {}
    agent.getPreparationDescription = preparationDescription
    agent.getRunningDescription = runningDescription
    agent.getCompletedDescription = completedDescription
    agent.getErrorDescription = errorDescription
    return agent
  }

  duplicate(nameSuffix = 'Copy'): Agent {
    const duplicated = new Agent()
    duplicated.uuid = crypto.randomUUID()
    duplicated.source = this.source
    duplicated.createdAt = Date.now()
    duplicated.updatedAt = Date.now()
    duplicated.name = `${this.name} - ${nameSuffix}`
    duplicated.description = this.description
    duplicated.type = this.type
    duplicated.engine = this.engine
    duplicated.model = this.model
    duplicated.modelOpts = this.modelOpts ? { ...this.modelOpts } : null
    duplicated.disableStreaming = this.disableStreaming
    duplicated.locale = this.locale
    duplicated.instructions = this.instructions
    duplicated.parameters = this.parameters ? [...this.parameters] : []
    duplicated.steps = this.steps ? JSON.parse(JSON.stringify(this.steps)) : []
    duplicated.schedule = this.schedule
    duplicated.webhookToken = this.webhookToken
    duplicated.invocationValues = this.invocationValues ? { ...this.invocationValues } : {}
    return duplicated
  }

  getPreparationDescription?: () => string
  getRunningDescription?: (args: any) => string
  getCompletedDescription?: (args: any, results: any) => string
  getErrorDescription?: (args: any, results: any) => string

}