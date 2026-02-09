
import { app } from 'electron'
import Store from 'electron-store'
import fs from 'fs'
import { beforeEach, expect, test, vi, Mock } from 'vitest'
import defaultSettings from '@root/defaults/settings.json'
import * as config from '@main/config'
import { migrateMcpToolNames } from '@main/migrations/mcp_tool_names'

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
    mkdirSync: vi.fn()
  }}
})

beforeEach(() => {
  vi.clearAllMocks()
  config.setSaveConfigInTests()
  config.clearAppSettingsCache()
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
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.openai.apiKey', 'encrypted-openai-api-key')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.lmstudio.apiKey', 'encrypted-dummy')
})

test('Uses cache on second load', () => {
  vi.spyOn(fs, 'readFileSync')
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/override1')
  config.loadSettings(app)
  expect(fs.readFileSync).toHaveBeenCalledTimes(2)
  config.loadSettings(app)
  expect(fs.readFileSync).toHaveBeenCalledTimes(2)
})

test('Does not save when unmodified', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/override1')
  const loaded = config.loadSettings(app)
  config.saveSettings(app, loaded)
  expect(fs.writeFileSync).not.toHaveBeenCalled()
  loaded.general.locale = 'en'
  config.saveSettings(app, loaded)
  expect(fs.writeFileSync).toHaveBeenCalled()
  vi.clearAllMocks()
  const loaded2 = config.loadSettings(app)
  expect(loaded2.general.locale).toBe('en')
  loaded2.general.locale = 'fr'
  config.saveSettings(app, loaded2)
  expect(fs.writeFileSync).toHaveBeenCalled()
})

test('Load engine config files', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/engines')
  const loaded = config.loadSettings(app)
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key')
  expect(loaded.engines.openai.models.chat).toHaveLength(1)
})

test('Load settings with error', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/invalid')
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

test('Load overridden settings 1', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/override1')
  const loaded = config.loadSettings(app)
  expect(loaded.general.locale).toBe('fr')
  expect(loaded.general.keepRunning).toBe(true)
})

test('Load overridden settings 2', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/override2')
  const loaded = config.loadSettings(app)
  expect(loaded.engines.openai.models.chat).toStrictEqual(['model1', 'model2'])
})

test('Backwards compatibility 1', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/compat1')
  const loaded = config.loadSettings(app)
  expect(loaded.general.proxyMode).toBe('bypass')
  expect(loaded.appearance.darkTint).toBe('blue')
  expect(loaded.engines.openai.model.chat).toBe('model1')
  expect(loaded.engines.ollama.model.chat).toBe('model2')
  expect(loaded.llm.defaults[0].instructions).toBe('instructions')
})

test('Backwards compatibility 2', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/compat2')
  const loaded = config.loadSettings(app)
  expect(loaded.engines.openai.apiKey).toBe('openai-api-key2')
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.openai.apiKey', 'encrypted-openai-api-key2')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.lmstudio.apiKey', 'encrypted-dummy')
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/config/compat2/settings.json', expect.any(String))
  const calls = (fs.writeFileSync as Mock).mock.calls
  expect(calls[calls.length-1][0]).toBe('tests/fixtures/config/compat2/settings.json')
  expect(JSON.stringify(calls[calls.length-1][1])).not.toContain('apiKey')
})

test('Save engine config', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/engines')
  const loaded = config.loadSettings(app)
  config.saveSettings(app, loaded, true)
  expect(fs.writeFileSync).toHaveBeenCalledWith('tests/fixtures/config/engines/engines/openai.json', expect.any(String))
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('tests/fixtures/config/engines/settings.json', expect.any(String))
  // @ts-expect-error mock type stuff
  const calls = (fs.writeFileSync.mock as Mock).calls
  const openai = JSON.parse(calls[0][1])
  expect(openai.models.chat).toHaveLength(1)
  const settings = JSON.parse(calls[calls.length - 1][1])
  expect(settings.engines.openai.apiKey).toBeUndefined()
  expect(settings.engines.openai.models).toBeUndefined()
})

test('Save apiKeys settings', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/unknown')
  const loaded = config.loadSettings(app)
  config.saveSettings(app, loaded, true)
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('tests/fixtures/config/unknown/settings.json', expect.any(String))
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).toHaveBeenCalledWith('engines.openai.apiKey', 'encrypted-openai-api-key')
})

test('Save apiKeys settings with safeKeys disabled', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/unknown')
  const loaded = config.loadSettings(app)
  vi.clearAllMocks()
  loaded.general.safeKeys = false
  config.saveSettings(app, loaded, true)
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('tests/fixtures/config/unknown/settings.json', expect.any(String))
  // @ts-expect-error mock type stuff
  const calls = (fs.writeFileSync.mock as Mock).calls
  const settings = JSON.parse(calls[calls.length - 1][1])
  expect(settings.engines.openai.apiKey).toBe('openai-api-key')
  expect(Store.prototype.delete).toHaveBeenCalledWith('engines.openai.apiKey')
  expect(Store.prototype.set).not.toHaveBeenCalled()
})

test('Backwards compatibility: Python plugin with binpath', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/python-binpath')
  const loaded = config.loadSettings(app)
  expect(loaded.plugins.python.runtime).toBe('native')
  expect(loaded.plugins.python.binpath).toBe('/usr/bin/python3')
})

test('Backwards compatibility: Python plugin without binpath', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/python-no-binpath')
  const loaded = config.loadSettings(app)
  expect(loaded.plugins.python.runtime).toBe('embedded')
})

test('Python plugin with runtime already set', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/python-with-runtime')
  const loaded = config.loadSettings(app)
  expect(loaded.plugins.python.runtime).toBe('native')
  expect(loaded.plugins.python.binpath).toBe('/opt/python3')
})

test('Backwards compatibility: old codeExecution object format', () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/old-code-execution')
  const loaded = config.loadSettings(app)
  expect(loaded.llm.codeExecution).toBe('disabled')
})

test('Migration: MCP tool name old suffix format', async () => {
  vi.mocked(app.getPath).mockReturnValue('./tests/fixtures/config/mcp-old-tool-names')

  // First load settings (migration not yet run)
  config.clearAppSettingsCache()
  const loaded = config.loadSettings(app)

  // Before migration, tools still have old suffixes
  expect(loaded.llm.defaults[0].tools).toContain('tool1___90ab')
  expect(loaded.prompt.tools).toContain('search___1234')
  expect(loaded.realtime.tools).toContain('voice___abcd')

  // Run the migration function (this is called from main.ts at startup)
  // The migration modifies and saves settings
  const migrated = await migrateMcpToolNames(app)
  expect(migrated).toBe(6)

  // The migration function loads its own copy of settings, migrates, and saves
  // It returns the count of migrated tool names
  // The fixture has: 3 with suffix in llm.defaults, 2 with suffix in prompt, 1 with suffix in realtime = 6
  // Actually: tool1___90ab, tool2___0abc, browse___cdef (3), search___1234, execute___5678 (2), voice___abcd (1) = 6
})
