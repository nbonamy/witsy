import { App } from 'electron'
import { HttpServer } from './http_server'
import { sendJson, sendError, parseParams, isHttpEndpointsEnabled } from './http_utils'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import Assistant from '../services/assistant'
import Message from '../models/message'
import Chat from '../models/chat'
import Mcp from './mcp'
import { LlmContext } from './llm_utils'
import * as config from './config'

/**
 * Install HTTP API endpoints on the server
 * These endpoints provide CLI access to Witsy functionality
 */
export function installApiEndpoints(httpServer: HttpServer, app: App, mcp: Mcp): void {

  // GET /api/cli/config - Get current CLI configuration
  httpServer.register('/api/cli/config', async (_req, res) => {
    // Note: This endpoint does not check isHttpEndpointsEnabled
    // It returns the enableHttpEndpoints status so CLI can check it
    try {
      const settings = config.loadSettings(app)
      const engine = settings.llm.engine
      const model = settings.engines[engine]?.model?.chat
      const userDataPath = app.getPath('userData')
      const enableHttpEndpoints = settings.general.enableHttpEndpoints

      sendJson(res, {
        engine,
        model,
        userDataPath,
        enableHttpEndpoints
      })
    } catch (error) {
      console.error('[http] Error in /api/cli/config:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  // GET /api/engines - List available chat engines
  httpServer.register('/api/engines', async (_req, res) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      const settings = config.loadSettings(app)
      const llmManager = LlmFactory.manager(settings)

      const engines = llmManager.getChatEngines({ favorites: false })
        .filter(engine => llmManager.isEngineConfigured(engine))
        .map(engine => ({
          id: engine,
          name: engineNames[engine] || engine
        }))

      sendJson(res, { engines })
    } catch (error) {
      console.error('[http] Error in /api/engines:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  // GET /api/models/:engine - List models for a specific engine
  httpServer.register('/api/models/*', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      const settings = config.loadSettings(app)
      const llmManager = LlmFactory.manager(settings)

      // Extract engine from URL path
      const pathParts = parsedUrl.pathname.split('/')
      const engine = pathParts[3] // /api/models/:engine

      if (!engine) {
        sendError(res, 'Engine parameter is required', 400)
        return
      }

      // Validate engine
      if (!llmManager.isEngineConfigured(engine)) {
        sendError(res, `Engine '${engine}' is not configured`, 404)
        return
      }

      // Get models
      const models = llmManager.getChatModels(engine).map(model => ({
        id: model.id,
        name: model.name || model.id
      }))

      sendJson(res, { engine, models })
    } catch (error) {
      console.error('[http] Error in /api/models:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  // POST /api/complete - Run chat completion
  httpServer.register('/api/complete', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      // Initialize LLM context (global mock + i18n)
      const llmContext = new LlmContext(app, mcp)
      const settings = llmContext.initializeContext()
      const llmManager = LlmFactory.manager(settings)

      // Parse request body
      const params = await parseParams(req, parsedUrl)
      const stream = params.stream !== 'false'
      const engine = params.engine || settings.llm.engine
      const noMarkdown = Boolean(params.noMarkdown)
      const thread: any[] = Array.isArray(params.thread) ? params.thread : []

      if (!Array.isArray(thread) || thread.length === 0) {
        sendError(res, 'Thread parameter is required and must be a non-empty array', 400)
        return
      }

      // Validate engine
      if (!llmManager.isEngineConfigured(engine)) {
        sendError(res, `Engine '${engine}' is not configured`, 404)
        return
      }

      // Get model
      const model = params.model || settings.engines[engine]?.model?.chat
      if (!model) {
        sendError(res, `No model specified or configured for engine '${engine}'`, 400)
        return
      }

      // Create assistant and chat
      const assistant = new Assistant(settings, settings.workspaceId)
      const chat = new Chat()
      chat.setEngineModel(engine, model)
      assistant.setChat(chat)

      // Deserialize messages
      const messages = thread.map((msg: any) => Message.fromJson(msg))
      messages.forEach(msg => chat.addMessage(msg))

      console.log(`[http] /api/complete - engine: ${engine}, model: ${model}, messages: ${messages.length}`)

      // Get the last user message as the prompt
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) {
        sendError(res, 'No user message found in thread', 400)
        return
      }
      const prompt = lastUserMessage.content || ''

      // Initialize LLM
      assistant.initLlm(engine)
      if (!assistant.hasLlm()) {
        sendError(res, `Failed to initialize LLM for engine '${engine}'`, 500)
        return
      }

      if (stream) {
        // Streaming mode - SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        })

        await assistant.prompt(prompt, {
          model,
          streaming: true,
          noMarkdown
        }, (chunk) => {
          if (chunk) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
        })

        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        // Non-streaming mode - JSON response
        await assistant.prompt(prompt, {
          model,
          streaming: false,
          noMarkdown
        }, () => {
          // Chunks will be accumulated in the assistant's response message
        })

        const response = chat.lastMessage()
        sendJson(res, {
          success: true,
          response: {
            content: response?.content,
            usage: response?.usage
          }
        })
      }
    } catch (error) {
      console.error('[http] Error in /api/complete:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  console.log('[http] API endpoints installed')
}
