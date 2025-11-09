import { LlmEngine } from 'multi-llm-ts'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Agent from '../models/agent'
import { Configuration } from '../types/config'
import { AgentRun } from '../types/agents'
import { ToolSelection } from '../types/llm'

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
  llmManager: ILlmManager

  constructor(config: Configuration, workspaceId: string, agent: Agent) {
    this.config = config
    this.llmManager = LlmFactory.manager(config)
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

  protected saveAgent(): void {
    window.api.agents.save(this.workspaceId, JSON.parse(JSON.stringify(this.agent)))
  }

  protected saveRun(run: AgentRun): void {
    window.api.agents.saveRun(this.workspaceId, {
      ...run,
      messages: run.messages.map(m => JSON.parse(JSON.stringify(m))),
    })
  }

  protected get codeExecutionMode(): boolean {
    return this.config.llm.codeExecution.modes.includes('agent')
  }

  protected async loadToolsAndAgents(engine: LlmEngine, tools: ToolSelection, agents: string[], opts?: { engine?: string, model?: string, agents?: Agent[] }): Promise<void> {

    // dynamic imports to avoid circular dependency
    const { availablePlugins } = await import('../plugins/plugins')
    const AgentPlugin = (await import('../plugins/agent')).default

    // load plugins using llmManager
    await this.llmManager.loadTools(engine, this.workspaceId, availablePlugins, tools, { codeExecutionMode: this.codeExecutionMode })

    // and now add tools for running agents
    const allAgents = [
      ...window.api.agents.list(this.workspaceId),
      ...(opts?.agents ?? []),
    ]

    for (const agentId of agents) {
      const agent = allAgents.find((a: Agent) => a.uuid === agentId)
      if (agent) {
        const plugin = new AgentPlugin(this.config, this.workspaceId, agent, agent.engine || opts?.engine, agent.model || opts?.model)
        engine.addPlugin(plugin)
      }
    }

  }


}
