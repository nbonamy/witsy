
import { AgentRun as AgentRunBase, AgentRunStatus, AgentRunTrigger } from 'types/agents'
import Message from './message'

export default class AgentRun implements AgentRunBase {

  uuid: string
  agentId: string
  createdAt: number
  updatedAt: number
  trigger: AgentRunTrigger
  status: AgentRunStatus
  prompt: string
  error?: string
  messages: Message[]

  constructor() {
    this.uuid = crypto.randomUUID()
    this.agentId = ''
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
    this.trigger = 'manual'
    this.status = 'running'
    this.prompt = ''
    this.messages = []
  }

  static fromJson(obj: any): AgentRun {
    const run = new AgentRun()
    run.uuid = obj.uuid || crypto.randomUUID()
    run.agentId = obj.agentId || ''
    run.createdAt = obj.createdAt
    run.updatedAt = obj.updatedAt
    run.trigger = obj.trigger || 'manual'
    run.status = obj.status || 'running'
    run.prompt = obj.prompt || ''
    run.error = obj.error || undefined
    run.messages = obj.messages ? obj.messages.map((msg: any) => Message.fromJson(msg)) : []
    return run
  }


}