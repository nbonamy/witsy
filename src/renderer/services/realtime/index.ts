/**
 * Realtime voice engine abstraction layer
 */

import { Configuration } from 'types/config'
import { RealtimeEngine, RealtimeEngineCallbacks, RealtimeVoice } from './engine'
import { RealtimeOpenAI } from './openai'

export function createRealtimeEngine(
  engineId: string,
  config: Configuration,
  callbacks: RealtimeEngineCallbacks
): RealtimeEngine {
  switch (engineId) {
    case 'openai':
      return new RealtimeOpenAI(config, callbacks)
    default:
      throw new Error(`Unknown realtime engine: ${engineId}`)
  }
}

export function getAvailableVoices(engineId: string): RealtimeVoice[] {
  switch (engineId) {
    case 'openai':
      return RealtimeOpenAI.getAvailableVoices()
    default:
      return []
  }
}

export * from './engine'
export { RealtimeOpenAI } from './openai'

// Re-export for tests
export { jsonSchemaToZod, convertToolToAgentsFormat } from './openai'
