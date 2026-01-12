/**
 * Realtime voice engine abstraction layer
 */

import { Configuration } from 'types/config'
import { RealtimeEngine, RealtimeEngineCallbacks, RealtimeVoice } from './engine'
import { RealtimeGemini } from './gemini'
import { RealtimeOpenAI } from './openai'

export function createRealtimeEngine(
  engineId: string,
  config: Configuration,
  callbacks: RealtimeEngineCallbacks
): RealtimeEngine {
  switch (engineId) {
    case 'openai':
      return new RealtimeOpenAI(config, callbacks)
    case 'google':
      return new RealtimeGemini(config, callbacks)
    default:
      throw new Error(`Unknown realtime engine: ${engineId}`)
  }
}

export function getAvailableVoices(engineId: string): RealtimeVoice[] {
  switch (engineId) {
    case 'openai':
      return RealtimeOpenAI.getAvailableVoices()
    case 'google':
      return RealtimeGemini.getAvailableVoices()
    default:
      return []
  }
}

export function getAvailableModels(engineId: string): { id: string, name: string }[] {
  switch (engineId) {
    case 'google':
      return RealtimeGemini.getAvailableModels()
    default:
      return []
  }
}

export function supportsTools(engineId: string): boolean {
  switch (engineId) {
    case 'openai':
    case 'google':
      return true
    default:
      return false
  }
}

export * from './engine'
export { RealtimeGemini } from './gemini'
export { RealtimeOpenAI } from './openai'

// Re-export for tests
export { jsonSchemaToZod, convertToolToAgentsFormat } from './openai'
