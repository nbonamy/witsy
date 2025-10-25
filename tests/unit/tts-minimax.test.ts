
import { expect, test, vi } from 'vitest'
import TTSMiniMax from '../../src/voice/tts-minimax'
import defaults from '../../defaults/settings.json'
import { Configuration } from '../../src/types/config'

vi.mock('../../src/main/ipc.ts', () => ({}))

test('TTSMiniMax Models', () => {
  expect(TTSMiniMax.models.length).toBe(4)
  expect(TTSMiniMax.models[0]).toHaveProperty('id')
  expect(TTSMiniMax.models[0]).toHaveProperty('label')
  expect(TTSMiniMax.models[0].id).toBe('speech-02-hd')
})

test('TTSMiniMax Voices', () => {
  const voices = TTSMiniMax.voices('speech-02-hd')
  expect(voices.length).toBeGreaterThan(0)
  expect(voices[0]).toHaveProperty('id')
  expect(voices[0]).toHaveProperty('label')
  expect(voices[0].id).toBe('Wise_Woman')
})

test('TTSMiniMax Constructor', () => {
  const config = defaults as unknown as Configuration
  const engine = new TTSMiniMax(config)
  expect(engine).toBeDefined()
  expect(engine.config).toBe(config)
})

test('TTSMiniMax synthetize not implemented', async () => {
  const config = defaults as unknown as Configuration
  const engine = new TTSMiniMax(config)
  await expect(engine.synthetize('test')).rejects.toThrow('Not implemented')
})
