import Chat from '@models/chat'
import Message from '@models/message'
import { App } from 'electron'
import { engineNames } from '../renderer/services/llms/base'
import LlmFactory from '../renderer/services/llms/llm'
import AssistantApi from './assistant_api'
import { WorkDirAccess } from './cli_plugin'
import * as config from './config'
import { loadHistory, saveHistory } from './history'
import { HttpServer } from './http_server'
import { isHttpEndpointsEnabled, parseParams, sendError, sendJson } from './http_utils'
import { LlmContext } from './llm_utils'
import Mcp from './mcp'
import DocumentRepository from './rag/docrepo'

/**
 * Install HTTP API endpoints on the server
 * These endpoints provide CLI access to Witsy functionality
 */
export function installApiEndpoints(httpServer: HttpServer, app: App, mcp: Mcp, docRepo: DocumentRepository): void {

  // GET /api/cli/config - Get current CLI configuration
  httpServer.register('/api/cli/config', async (_req, res) => {
    // Note: This endpoint does not check isHttpEndpointsEnabled
    // It returns the enableHttpEndpoints status so CLI can check it
    try {
      const settings = config.loadSettings(app)
      const llmManager = LlmFactory.manager(settings)
      const engineId = settings.llm.engine
      const modelId = settings.engines[engineId]?.model?.chat
      const userDataPath = app.getPath('userData')
      const enableHttpEndpoints = settings.general.enableHttpEndpoints

      // Get engine name
      const engineName = engineNames[engineId] || engineId

      // Get model name
      const models = llmManager.getChatModels(engineId)
      const modelInfo = models.find(m => m.id === modelId)
      const modelName = modelInfo?.name || modelId

      sendJson(res, {
        engine: { id: engineId, name: engineName },
        model: { id: modelId, name: modelName },
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
      const llmContext = new LlmContext(app, mcp, docRepo)
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

      // Parse workDir if provided
      let workDir = null
      if (params.workDir && typeof params.workDir === 'object') {
        const wd = params.workDir as { path?: string | null; access?: WorkDirAccess }
        if (wd.path && wd.access && wd.access !== 'none') {
          workDir = { path: wd.path, access: wd.access }
        }
      }

      // Create AssistantApi with workDir configuration
      const assistant = new AssistantApi(settings, workDir)
      assistant.initializeChat(engine, model)

      // Deserialize and add messages (except last user message which is the prompt)
      const messages = thread.map((msg: any) => Message.fromJson(msg))
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) {
        sendError(res, 'No user message found in thread', 400)
        return
      }

      // Add all messages except the last user message (that's our prompt)
      const historyMessages = messages.slice(0, messages.lastIndexOf(lastUserMessage))
      assistant.addMessages(historyMessages)

      const prompt = lastUserMessage.content || ''
      console.log(`[http] /api/complete - engine: ${engine}, model: ${model}, messages: ${messages.length}${workDir ? `, workDir: ${workDir.path} (${workDir.access})` : ''}`)

      if (stream) {
        // Streaming mode - SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        })

        const abortController = new AbortController()
        await assistant.prompt(prompt, {
          engine,
          model,
          noMarkdown,
          abortSignal: abortController.signal,
        }, (chunk) => {
          if (chunk) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
        })

        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        // Non-streaming mode - JSON response
        const abortController = new AbortController()
        await assistant.prompt(prompt, {
          engine,
          model,
          noMarkdown,
          abortSignal: abortController.signal,
        }, () => {
          // Chunks will be accumulated in the assistant's response message
        })

        const response = assistant.getLastMessage()
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

  // POST /api/conversations - Save or update a chat conversation
  httpServer.register('/api/conversations', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      // Load settings to get workspace ID
      const settings = config.loadSettings(app)
      const workspaceId = settings.workspaceId

      // Parse request body
      const params = await parseParams(req, parsedUrl)
      if (!params.chat) {
        sendError(res, 'Chat parameter is required', 400)
        return
      }

      // Deserialize chat
      const chat = Chat.fromJson(params.chat)

      // Load history for workspace
      const history = await loadHistory(app, workspaceId)

      // Create or update chat
      if (!chat.uuid || chat.uuid === '') {
        // Create new chat
        chat.uuid = crypto.randomUUID()
        chat.initTitle()
        history.chats.push(chat)
        console.log(`[http] Created new chat: ${chat.uuid}`)
      } else {
        // Update existing chat
        const index = history.chats.findIndex(c => c.uuid === chat.uuid)
        if (index >= 0) {
          history.chats[index] = chat
          console.log(`[http] Updated existing chat: ${chat.uuid}`)
        } else {
          // Fallback: add as new if not found
          history.chats.push(chat)
          console.log(`[http] Chat not found, added as new: ${chat.uuid}`)
        }
      }

      // Save history
      saveHistory(app, workspaceId, history)

      sendJson(res, { chatId: chat.uuid })
    } catch (error) {
      console.error('[http] Error in /api/conversations:', error)
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  console.log('[http] API endpoints installed')
}
