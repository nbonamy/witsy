import { App } from 'electron'
import { AgentExecutor, findAgentByWebhookToken } from './agent_utils'
import { HttpServer } from './http_server'
import { parseParams, sendError, sendJson } from './http_utils'
import Mcp from './mcp'

/**
 * Install agent webhook endpoints on the HTTP server
 * Allows agents to be triggered via HTTP requests with webhook tokens
 */
export function installAgentWebhook(httpServer: HttpServer, app: App, mcp: Mcp): void {

  httpServer.register('/agent/run/*', async (req, res, parsedUrl) => {
    try {
      // Extract token from URL path
      const pathParts = parsedUrl.pathname.split('/')
      const token = pathParts[3] // /agent/run/:token

      // Find agent by token
      const result = findAgentByWebhookToken(app, token)
      if (!result) {
        sendError(res, 'Agent not found', 404)
        return
      }

      const { agent, workspaceId } = result

      // Parse parameters from request
      const params = await parseParams(req, parsedUrl)

      // Build prompt with parameters
      const prompt = agent.buildPrompt(0, params)
      if (!prompt) {
        sendError(res, 'Failed to build prompt', 400)
        return
      }

      // Run agent
      const runId = crypto.randomUUID()
      const executor = new AgentExecutor(app, mcp)
      executor.runAgent(workspaceId, agent, 'webhook', prompt, runId)

      sendJson(res, {
        success: true,
        runId: runId,
      })

    } catch (error) {
      console.error('[http] Error in agent webhook:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  console.log('[http] Agent webhook installed')
}
