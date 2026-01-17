import { App } from 'electron'
import PromptAnywhere from './automations/anywhere'
import Automator from './automations/automator'
import Commander from './automations/commander'
import ReadAloud from './automations/readaloud'
import Dictation from './automations/dictation'
import { HttpServer } from './http_server'
import { isHttpEndpointsEnabled, parseParams, sendError, sendJson } from './http_utils'
import { putCachedText } from './utils'
import * as window from './window'

/**
 * Install HTTP trigger endpoints on the server
 * These endpoints allow external applications to trigger Witsy commands via HTTP
 */
export function installHttpTriggers(httpServer: HttpServer, app: App): void {

  // Health check endpoint
  httpServer.register('/api/health', (_req, res) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    sendJson(res, {
      status: 'ok',
      server: 'witsy-http-triggers',
      version: '1.0.0'
    })
  })

  // Window commands
  httpServer.register('/api/chat', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      const params = await parseParams(req, parsedUrl)
      window.openMainWindow({ queryParams: { view: 'chat', ...(params.text ? { text: params.text } : {}) } })
      sendJson(res, { success: true, action: 'chat' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/scratchpad', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      await parseParams(req, parsedUrl) // Parse for consistency even if not used
      window.openMainWindow({ queryParams: { view: 'scratchpad' } })
      sendJson(res, { success: true, action: 'scratchpad' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/settings', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      await parseParams(req, parsedUrl)
      window.openSettingsWindow()
      sendJson(res, { success: true, action: 'settings' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/studio', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      await parseParams(req, parsedUrl)
      window.openDesignStudioWindow()
      sendJson(res, { success: true, action: 'studio' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/forge', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      await parseParams(req, parsedUrl)
      window.openAgentForgeWindow()
      sendJson(res, { success: true, action: 'forge' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/realtime', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
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
    if (!isHttpEndpointsEnabled(app, res)) return
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
    if (!isHttpEndpointsEnabled(app, res)) return
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
    if (!isHttpEndpointsEnabled(app, res)) return
    try {
      await parseParams(req, parsedUrl)
      await Dictation.initDictation()
      sendJson(res, { success: true, action: 'transcribe' })
    } catch (error) {
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500)
    }
  })

  httpServer.register('/api/readaloud', async (req, res, parsedUrl) => {
    if (!isHttpEndpointsEnabled(app, res)) return
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
