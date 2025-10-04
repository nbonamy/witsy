import { App } from 'electron'
import { IncomingMessage, ServerResponse } from 'node:http'
import { HttpServer } from './http_server'
import { putCachedText } from './utils'
import * as window from './window'
import Automator from '../automations/automator'
import PromptAnywhere from '../automations/anywhere'
import Commander from '../automations/commander'
import ReadAloud from '../automations/readaloud'
import Transcriber from '../automations/transcriber'

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, data: any, statusCode = 200): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * Send error response
 */
function sendError(res: ServerResponse, message: string, statusCode = 400): void {
  sendJson(res, { success: false, error: message }, statusCode)
}

/**
 * Parse request parameters from GET query or POST body
 */
async function parseParams(req: IncomingMessage, parsedUrl: URL): Promise<Record<string, string>> {
  const params: Record<string, string> = {}

  // Parse query parameters (GET requests)
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value
  })

  // Parse POST body if present
  if (req.method === 'POST') {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        let data = ''
        req.on('data', chunk => data += chunk)
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })

      if (body) {
        const contentType = req.headers['content-type'] || ''

        if (contentType.includes('application/json')) {
          const jsonData = JSON.parse(body)
          Object.assign(params, jsonData)
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const urlParams = new URLSearchParams(body)
          urlParams.forEach((value, key) => {
            params[key] = value
          })
        }
      }
    } catch (error) {
      console.error('[http] Error parsing POST body:', error)
    }
  }

  return params
}

/**
 * Install HTTP trigger endpoints on the server
 * These endpoints allow external applications to trigger Witsy commands via HTTP
 */
export function installHttpTriggers(httpServer: HttpServer, app: App): void {

  // Health check endpoint
  httpServer.register('/api/health', (_req, res) => {
    sendJson(res, {
      status: 'ok',
      server: 'witsy-http-triggers',
      version: '1.0.0'
    })
  })

  // Window commands
  httpServer.register('/api/chat', async (req, res, parsedUrl) => {
    try {
      const params = await parseParams(req, parsedUrl)
      window.openMainWindow({ queryParams: { view: 'chat', ...(params.text ? { text: params.text } : {}) } })
      sendJson(res, { success: true, action: 'chat' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/scratchpad', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl) // Parse for consistency even if not used
      window.openMainWindow({ queryParams: { view: 'scratchpad' } })
      sendJson(res, { success: true, action: 'scratchpad' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/settings', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      window.openSettingsWindow()
      sendJson(res, { success: true, action: 'settings' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/studio', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      window.openDesignStudioWindow()
      sendJson(res, { success: true, action: 'studio' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/forge', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      window.openAgentForgeWindow()
      sendJson(res, { success: true, action: 'forge' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/realtime', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      window.openRealtimeChatWindow()
      sendJson(res, { success: true, action: 'realtime' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  // Automation commands
  httpServer.register('/api/prompt', async (req, res, parsedUrl) => {
    try {
      const params = await parseParams(req, parsedUrl)
      if (params.text) {
        const promptId = putCachedText(params.text)
        window.openPromptAnywhere({ promptId })
      } else {
        PromptAnywhere.open()
      }
      sendJson(res, { success: true, action: 'prompt' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/command', async (req, res, parsedUrl) => {
    try {
      const params = await parseParams(req, parsedUrl)
      if (params.text) {
        const textId = putCachedText(params.text)
        const automator = new Automator()
        const sourceApp = await automator.getForemostApp()
        window.openCommandPicker({ textId, sourceApp, startTime: Date.now() })
      } else {
        await Commander.initCommand(app)
      }
      sendJson(res, { success: true, action: 'command' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/transcribe', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      await Transcriber.initTranscription()
      sendJson(res, { success: true, action: 'transcribe' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/readaloud', async (req, res, parsedUrl) => {
    try {
      await parseParams(req, parsedUrl)
      await ReadAloud.read(app)
      sendJson(res, { success: true, action: 'readaloud' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  console.log('[http] HTTP triggers installed')
}
