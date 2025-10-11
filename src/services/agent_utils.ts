import { Configuration } from '../types/config'
import { AgentRun, AgentRunTrigger, Chat } from '../types/index'
import { store } from './store'
import Agent from '../models/agent'
import AgentWorkflowExecutor from './agent_executor_workflow'
import AgentA2AExecutor from './agent_executor_a2a'
import { GenerationCallback } from './generator'

export interface AgentExecutor {
  run(trigger: AgentRunTrigger, prompt?: string, opts?: any, generationCallback?: GenerationCallback): Promise<AgentRun>
}

/**
 * Factory function to create the appropriate executor based on agent type
 */
export function createAgentExecutor(
  config: Configuration,
  workspaceId: string,
  agent: Agent
): AgentExecutor {
  return agent.source === 'a2a'
    ? new AgentA2AExecutor(config, workspaceId, agent)
    : new AgentWorkflowExecutor(config, workspaceId, agent)
}

/**
 * Check if the chat is in an agent conversation context
 * Returns the agent if chat is in conversational mode with an A2A agent, null otherwise
 */
export function isAgentConversation(chat: Chat): Agent|null {

  // check message
  const message = chat.lastMessage()
  if (!message) return null
  if (!message.agentId) return null

  // we need the agent anyway
  const agent = store.agents.find((a) => a.uuid === message.agentId)
  if (!agent) return null

  // a2a agents are conversational
  if (agent && agent.source === 'a2a') {
    return agent
  }

  // nope
  return null

}
