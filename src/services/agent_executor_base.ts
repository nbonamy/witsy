import Agent from '../models/agent'
import { Configuration } from '../types/config'
import { AgentRun } from '../types/index'

export interface AgentExecutorOpts {
  runId?: string
  ephemeral?: boolean
  chat?: any
  abortSignal?: AbortSignal
}

export default class AgentExecutorBase {

  config: Configuration
  workspaceId: string
  agent: Agent

  constructor(config: Configuration, workspaceId: string, agent: Agent) {
    this.config = config
    this.workspaceId = workspaceId
    this.agent = agent
  }

  protected checkAbort(run: AgentRun, opts?: AgentExecutorOpts): boolean {
    if (opts?.abortSignal?.aborted) {
      run.status = 'canceled'
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }
      if (opts?.chat) {
        opts.chat.lastMessage().appendText({
          type: 'content', text: '', done: true
        })
      }
      return true
    }
    return false
  }

  protected saveRun(run: AgentRun): void {
    window.api.agents.saveRun(this.workspaceId, {
      ...run,
      messages: run.messages.map(m => JSON.parse(JSON.stringify(m))),
    })
  }

}
