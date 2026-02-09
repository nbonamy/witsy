import { AgentRun, AgentRunTrigger } from 'types/agents'
import { Configuration } from 'types/config'
import { Chat } from 'types/index'
import { McpTool } from 'types/mcp'
import Agent from '@models/agent'
import AgentA2AExecutor from './agent_executor_a2a'
import AgentWorkflowExecutor from './agent_executor_workflow'
import { GenerationCallback } from './generator'
import { t } from './i18n'
import { store } from './store'

export interface AgentExecutor {
  run(trigger: AgentRunTrigger, values: Record<string, string>, opts?: any, generationCallback?: GenerationCallback): Promise<AgentRun>
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

/**
 * Remap MCP tool references in an imported agent to match local tool names
 * Returns the remapped agent and a list of warnings for unmatched tools
 */
export async function remapAgentMcpTools(agent: Agent): Promise<{ agent: Agent, warnings: string[] }> {

  const warnings: string[] = []

  // Get all available MCP tools from local servers
  const serversWithTools = await window.api.mcp.getAllServersWithTools()
  const allTools: McpTool[] = serversWithTools.flatMap(({ tools }) => tools)

  // Process each step in the agent
  agent.steps.forEach((step, stepIndex) => {
    if (!step.tools || step.tools.length === 0) return

    const remappedTools: string[] = []

    step.tools.forEach((toolFunction) => {

      if (!window.api.mcp.isMcpToolName(toolFunction)) {
        // Not an MCP tool reference, keep as is
        remappedTools.push(toolFunction)
        return
      }

      // Strip suffix to get original tool name
      const originalName = window.api.mcp.originalToolName(toolFunction)

      // Find matching local tools by original name
      const matches = allTools.filter(tool => tool.name === originalName)

      if (matches.length === 1) {
        // Exactly one match - remap to local tool function name
        remappedTools.push(matches[0].function)
      } else {
        // No match or multiple matches - add warning
        warnings.push(t('agent.forge.import.toolNotFound', { step: stepIndex + 1, tool: originalName }))
      }
    })

    // Update step with remapped tools
    step.tools = remappedTools
  })

  return { agent, warnings }
}
