
import { app } from 'electron'
import { Configuration } from '../../src/types/config'
import { vi, expect, test, Mock } from 'vitest'
import * as config from '../../src/main/config'
import defaultSettings from '../../defaults/settings.json'
import Store from 'electron-store'
import fs from 'fs'

vi.mock('electron', async () => {
  return {
    app: {
      getPath: vi.fn(() => ''),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((data) => `encrypted-${data}`),
      decryptString: vi.fn((data) => data.toString('latin1'))
    }
  }
})

vi.mock('electron-store', async () => {
  const Store = vi.fn()
  Store.prototype.store = {
    'engines.openai.apiKey': Buffer.from('openai-api-key', 'latin1')
  }
  Store.prototype.delete = vi.fn()
  Store.prototype.set = vi.fn()
  return { default: Store }
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
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key')
  loaded.engines.openai.apiKey = ''
  expect(loaded).toStrictEqual(defaultSettings)
  expect(loaded.general.locale).toBe('')
  expect(loaded.engines.openai.models.chat).toStrictEqual([])
  expect(Store.prototype.set).not.toHaveBeenCalled()
})

test('Load engine config files', () => {
  app.getPath = vi.fn(() => './tests/fixtures/engines')
  const loaded = config.loadSettings(app)
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key')
  expect(loaded.engines.openai.models.chat).toHaveLength(1)
})

test('Load settings with error', () => {
  app.getPath = vi.fn(() => './tests/fixtures/invalid')
  const loaded = config.loadSettings(app)
  expect(config.settingsFileHadError()).toBe(true)
  loaded.engines.openai.baseURL = defaultSettings.engines.openai.baseURL
  loaded.engines.ollama.baseURL = defaultSettings.engines.ollama.baseURL
  loaded.engines.lmstudio.baseURL = defaultSettings.engines.lmstudio.baseURL
  loaded.engines.sdwebui.baseURL = defaultSettings.engines.sdwebui.baseURL
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key')
  loaded.engines.openai.apiKey = ''
  expect(loaded).toStrictEqual(defaultSettings)
})

test('Load overridden settings', () => {
  const loaded1: Configuration = config.loadSettings('./tests/fixtures/config1.json')
  expect(loaded1.general.locale).toBe('fr')
  expect(loaded1.general.keepRunning).toBe(true)

  const loaded2 = config.loadSettings('./tests/fixtures/config2.json')
  expect(loaded2.engines.openai.models.chat).toStrictEqual(['model1', 'model2'])
})

test('Backwards compatibility 1', () => {
  const loaded = config.loadSettings('./tests/fixtures/config_compat1.json')
  expect(loaded.general.proxyMode).toBe('bypass')
  expect(loaded.appearance.darkTint).toBe('blue')
  expect(loaded.engines.openai.model.chat).toBe('model1')
  expect(loaded.engines.ollama.model.chat).toBe('model2')
  expect(loaded.llm.defaults[0].instructions).toBe('instructions')
})

test('Backwards compatibility 2', () => {
  const loaded = config.loadSettings('./tests/fixtures/config_compat2.json')
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key2')
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).toHaveBeenLastCalledWith('engines.openai.apiKey', 'encrypted-openai-api-key2')
})

test('Save settings', () => {
  const loaded = config.loadSettings('')
  config.saveSettings('settings.json', loaded)
  const saved = JSON.parse(JSON.stringify(loaded))
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('settings.json', JSON.stringify(saved, null, 2))
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.openai.apiKey', 'encrypted-openai-api-key')
})

test('Save engine config', () => {
  app.getPath = vi.fn(() => './tests/fixtures/engines')
  const loaded = config.loadSettings(app)
  config.saveSettings(app, loaded)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/engines/engines/openai.json', expect.any(String))
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/engines/settings.json', expect.any(String))
  // @ts-expect-error mock type stuff
  const calls = (fs.writeFileSync.mock as Mock).calls
  const openai = JSON.parse(calls[1][1])
  expect(openai.models.chat).toHaveLength(1)
  const settings = JSON.parse(calls[calls.length - 1][1])
  expect(settings.engines.openai.apiKey).toBeUndefined()
  expect(settings.engines.openai.models).toBeUndefined()
})
