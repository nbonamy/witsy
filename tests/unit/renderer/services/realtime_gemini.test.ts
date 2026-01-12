import { test, expect, describe } from 'vitest'
import { RealtimeGemini, RealtimeEngineCallbacks } from '@services/realtime'
import { Configuration } from 'types/config'
import defaults from '@root/defaults/settings.json'

describe('RealtimeGemini', () => {

  const mockCallbacks: RealtimeEngineCallbacks = {
    onStatusChange: () => {},
    onNewMessage: () => {},
    onMessageUpdated: () => {},
    onMessageToolCall: () => {},
    onUsageUpdated: () => {},
    onError: () => {},
  }

  const mockConfig = defaults as unknown as Configuration

  describe('getAvailableVoices', () => {

    test('returns Gemini voices', () => {
      const voices = RealtimeGemini.getAvailableVoices()
      expect(voices.length).toBeGreaterThan(0)
      expect(voices.map(v => v.id)).toContain('Puck')
      expect(voices.map(v => v.id)).toContain('Charon')
      expect(voices.map(v => v.id)).toContain('Kore')
    })

    test('voices have id and name', () => {
      const voices = RealtimeGemini.getAvailableVoices()
      for (const voice of voices) {
        expect(voice.id).toBeDefined()
        expect(voice.name).toBeDefined()
        expect(voice.id).toBe(voice.name) // Gemini voices have same id and name
      }
    })

  })

  describe('getAvailableModels', () => {

    test('returns Gemini Live models', () => {
      const models = RealtimeGemini.getAvailableModels()
      expect(models.length).toBeGreaterThan(0)
      // Check for expected model
      const modelIds = models.map(m => m.id)
      expect(modelIds.some(id => id.includes('gemini'))).toBe(true)
    })

    test('models have id and name', () => {
      const models = RealtimeGemini.getAvailableModels()
      for (const model of models) {
        expect(model.id).toBeDefined()
        expect(model.name).toBeDefined()
      }
    })

  })

  describe('supportsTools', () => {

    test('returns false', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)
      expect(engine.supportsTools).toBe(false)
    })

  })

  describe('instance without session', () => {

    test('isConnected returns false', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)
      expect(engine.isConnected()).toBe(false)
    })

    test('getUsage returns zeros', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)
      const usage = engine.getUsage()
      expect(usage.audioInputTokens).toBe(0)
      expect(usage.textInputTokens).toBe(0)
      expect(usage.cachedAudioTokens).toBe(0)
      expect(usage.cachedTextTokens).toBe(0)
      expect(usage.audioOutputTokens).toBe(0)
      expect(usage.textOutputTokens).toBe(0)
    })

    test('close works without error', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)
      expect(() => engine.close()).not.toThrow()
    })

  })

  describe('getCostInfo', () => {

    test('calculates cost correctly', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)

      const usage = {
        audioInputTokens: 1000000, // 1M tokens
        textInputTokens: 1000000,
        cachedAudioTokens: 0,
        cachedTextTokens: 0,
        audioOutputTokens: 1000000,
        textOutputTokens: 1000000,
      }

      const costInfo = engine.getCostInfo(usage)

      // Verify pricing model info
      expect(costInfo.pricingModel).toBe('gemini-2.5-flash-native-audio')
      expect(costInfo.pricingUrl).toContain('google.dev')

      // Verify costs are calculated
      // Text input: $0.50/1M = $0.50
      // Audio input: $3.00/1M = $3.00
      // Text output: $2.00/1M = $2.00
      // Audio output: $12.00/1M = $12.00
      expect(costInfo.cost.input).toBeCloseTo(3.50, 2) // 0.50 + 3.00
      expect(costInfo.cost.output).toBeCloseTo(14.00, 2) // 2.00 + 12.00
      expect(costInfo.cost.total).toBeCloseTo(17.50, 2)
      expect(costInfo.cost.total).toBe(costInfo.cost.input + costInfo.cost.output)
    })

    test('returns zero cost for zero usage', () => {
      const engine = new RealtimeGemini(mockConfig, mockCallbacks)

      const usage = {
        audioInputTokens: 0,
        textInputTokens: 0,
        cachedAudioTokens: 0,
        cachedTextTokens: 0,
        audioOutputTokens: 0,
        textOutputTokens: 0,
      }

      const costInfo = engine.getCostInfo(usage)

      expect(costInfo.cost.input).toBe(0)
      expect(costInfo.cost.output).toBe(0)
      expect(costInfo.cost.total).toBe(0)
    })

  })

})
