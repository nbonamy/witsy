
import { LlmModelOpts } from 'multi-llm-ts'
import { type Agent as AgentBase } from '../types/index'

export default class Agent implements AgentBase {

  id: string
  name: string
  description: string
  engine: string|null
  model: string|null
  modelOpts: LlmModelOpts|null = null
  disableStreaming: boolean = false
  locale: string|null
  tools: string[]|null
  docrepo: string|null
  instructions: string
  prompt: string|null

  constructor() {
    this.id = crypto.randomUUID()
    this.name = ''
    this.description = ''
    this.engine = null
    this.model = null
    this.modelOpts = null
    this.disableStreaming = false
    this.locale = null
    this.tools = null
    this.docrepo = null
    this.instructions = ''
    this.prompt = null
  }

  static fromJson(obj: any): Agent {
    const agent = new Agent()
    agent.id = obj.id || crypto.randomUUID()
    agent.name = obj.name
    agent.description = obj.description
    agent.engine = obj.engine
    agent.model = obj.model
    agent.modelOpts = obj.modelOpts
    agent.disableStreaming = obj.disableStreaming
    agent.locale = obj.locale
    agent.tools = obj.tools
    agent.docrepo = obj.docrepo
    agent.instructions = obj.instructions
    agent.prompt = obj.prompt
    return agent
  }
  
}
