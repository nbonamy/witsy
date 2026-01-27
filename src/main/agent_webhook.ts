import { App } from 'electron'
import { v7 as uuidv7 } from 'uuid'
import { AgentExecutor, findAgentByWebhookToken } from './agent_utils'
import { getAgentRun } from './agents'
import { HttpServer } from './http_server'
import { isHttpEndpointsEnabled, parseParams, sendError, sendJson } from './http_utils'
import Mcp from './mcp'
import DocumentRepository from './rag/docrepo'

/**
 * Base path for agent API endpoints
 */
export const AGENT_API_BASE_PATH = '/api/agent'

/**
 * Install agent webhook endpoints on the HTTP server
 * Allows agents to be triggered via HTTP requests with webhook tokens
 */
export function installAgentWebhook(httpServer: HttpServer, app: App, mcp: Mcp, docRepo: DocumentRepository): void {

  httpServer.register(`${AGENT_API_BASE_PATH}/run/*`, async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      // Extract token from URL path
      const pathParts = parsedUrl.pathname.split('/')
      const token = pathParts[4] // /api/agent/run/:token

      // Find agent by token
      const result = findAgentByWebhookToken(app, token)
      if (!result) {
        sendError(res, 'Agent not found', 404)
        return
      }

      const { agent, workspaceId } = result

      // Parse parameters from request
      const params = await parseParams(req, parsedUrl)

      // Merge invocation values with request parameters
      const values = {
        ...agent.invocationValues,
        ...params
      }

      // Run agent
      const runId = uuidv7()
      const executor = new AgentExecutor(app, mcp, docRepo)
      executor.runAgent(workspaceId, agent, 'webhook', values, runId)

      sendJson(res, {
        success: true,
        runId: runId,
        statusUrl: `${AGENT_API_BASE_PATH}/status/${token}/${runId}`
      })

    } catch (error) {
      console.error('[http] Error in agent webhook:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  // Status endpoint: GET /api/agent/status/:token/:runId
  httpServer.register(`${AGENT_API_BASE_PATH}/status/*`, async (req, res, parsedUrl) => {
    try {
      // Extract token and runId from URL path
      const pathParts = parsedUrl.pathname.split('/')
      const token = pathParts[4]  // /api/agent/status/:token/:runId
      const runId = pathParts[5]

      // Find agent by token
      const result = findAgentByWebhookToken(app, token)
      if (!result) {
        sendError(res, 'Agent not found', 404)
        return
      }

      const { agent, workspaceId } = result

      // Load agent run
      const run = getAgentRun(app, workspaceId, agent.uuid, runId)
      if (!run) {
        sendError(res, 'Run not found', 404)
        return
      }

      // Build response
      const response: any = {
        success: true,
        runId: run.uuid,
        agentId: run.agentId,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        trigger: run.trigger
      }

      // Add error if present
      if (run.error) {
        response.error = run.error
      }

      // Add output (last message text content) if run is complete and successful
      if (run.status === 'success' && run.messages && run.messages.length > 0) {
        const lastMessage = run.messages[run.messages.length - 1]
        // Strip out <tool> tags from output (e.g., <tool id="call_xyz"></tool>)
        response.output = (lastMessage.content || '').replace(/<tool[^>]*?><\/tool>/g, '')
      }

      sendJson(res, response)

    } catch (error) {
      console.error('[http] Error in agent status:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  console.log('[http] Agent webhook installed')
}
