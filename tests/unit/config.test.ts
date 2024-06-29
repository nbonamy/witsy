
import { Configuration } from '../../src/types/config.d'
import { vi, expect, test } from 'vitest'
import * as config from '../../src/main/config'
import defaultSettings from '../../defaults/settings.json'
import fs from 'fs'

vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    writeFileSync: vi.fn(),
  }}
})

test('Load default settings', () => {
  const loaded = config.loadSettings('')
  delete loaded.getActiveModel
  loaded.engines.openai.baseURL = defaultSettings.engines.openai.baseURL
  loaded.engines.ollama.baseURL = defaultSettings.engines.ollama.baseURL
  expect(loaded).toStrictEqual(defaultSettings)
  expect(loaded.general.language).toBe('')
  expect(loaded.engines.openai.models.chat).toStrictEqual([])
})

test('Load overridden settings', () => {
  const loaded1: Configuration = config.loadSettings('./tests/fixtures/config1.json')
  expect(loaded1.general.language).toBe('fr')
  expect(loaded1.general.keepRunning).toBe(true)

  const loaded2 = config.loadSettings('./tests/fixtures/config2.json')
  expect(loaded2.engines.openai.models.chat).toStrictEqual(['model1', 'model2'])
})

test('Active model', () => {
  const loaded = config.loadSettings('./tests/fixtures/config3.json')
  expect(loaded.getActiveModel()).toBe('model1')
})

test('Save settings', () => {
  const loaded = config.loadSettings('')
  config.saveSettings('settings.json', loaded)
  const saved = JSON.parse(JSON.stringify(loaded))
  saved.instructions = {}
  expect(fs.writeFileSync).toHaveBeenCalledWith('settings.json', JSON.stringify(saved, null, 2))
})