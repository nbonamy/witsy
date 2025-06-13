
import { app } from 'electron'
import { Configuration } from '../../src/types/config'
import { vi, expect, test } from 'vitest'
import * as config from '../../src/main/config'
import defaultSettings from '../../defaults/settings.json'
import fs from 'fs'

vi.mock('electron', async () => {
  return {
    app: {
      getPath: vi.fn(() => '')
    }
  }
})

vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    writeFileSync: vi.fn(),
  }}
})

test('Load default settings', () => {
  const loaded = config.loadSettings(app)
  expect(config.settingsFileHadError()).toBe(false)
  loaded.engines.openai.baseURL = defaultSettings.engines.openai.baseURL
  loaded.engines.ollama.baseURL = defaultSettings.engines.ollama.baseURL
  loaded.engines.lmstudio.baseURL = defaultSettings.engines.lmstudio.baseURL
  loaded.engines.sdwebui.baseURL = defaultSettings.engines.sdwebui.baseURL
  expect(loaded).toStrictEqual(defaultSettings)
  expect(loaded.general.locale).toBe('')
  expect(loaded.engines.openai.models.chat).toStrictEqual([])
})

test('Load settings with error', () => {
  app.getPath = vi.fn(() => './tests/fixtures/invalid')
  const loaded = config.loadSettings(app)
  expect(config.settingsFileHadError()).toBe(true)
  loaded.engines.openai.baseURL = defaultSettings.engines.openai.baseURL
  loaded.engines.ollama.baseURL = defaultSettings.engines.ollama.baseURL
  loaded.engines.lmstudio.baseURL = defaultSettings.engines.lmstudio.baseURL
  loaded.engines.sdwebui.baseURL = defaultSettings.engines.sdwebui.baseURL
  expect(loaded).toStrictEqual(defaultSettings)
})

test('Load overridden settings', () => {
  const loaded1: Configuration = config.loadSettings('./tests/fixtures/config1.json')
  expect(loaded1.general.locale).toBe('fr')
  expect(loaded1.general.keepRunning).toBe(true)

  const loaded2 = config.loadSettings('./tests/fixtures/config2.json')
  expect(loaded2.engines.openai.models.chat).toStrictEqual(['model1', 'model2'])
})

test('Save settings', () => {
  const loaded = config.loadSettings('')
  config.saveSettings('settings.json', loaded)
  const saved = JSON.parse(JSON.stringify(loaded))
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('settings.json', JSON.stringify(saved, null, 2))
})
