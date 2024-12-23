
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

test('Save settings', () => {
  const loaded = config.loadSettings('')
  config.saveSettings('settings.json', loaded)
  const saved = JSON.parse(JSON.stringify(loaded))
  saved.instructions = {}
  expect(fs.writeFileSync).toHaveBeenCalledWith('settings.json', JSON.stringify(saved, null, 2))
})

test('Nullify instructions', () => {

  const defaults = {
    key1: 'value1',
    key2: 'value2',
    dict1: {
      key1: 'value1',
      key2: 'value2',
    }
  }

  let input = JSON.parse(JSON.stringify(defaults))
  let reference = JSON.parse(JSON.stringify(defaults))
  config.nullifyInstructions(input, reference)
  expect(input).toStrictEqual({})

  input = JSON.parse(JSON.stringify(defaults))
  reference = JSON.parse(JSON.stringify(defaults))
  input.key1 = 'value3'
  config.nullifyInstructions(input, reference)
  expect(input).toStrictEqual({key1: 'value3'})

  input = JSON.parse(JSON.stringify(defaults))
  reference = JSON.parse(JSON.stringify(defaults))
  input.dict1.key1 = 'value3'
  config.nullifyInstructions(input, reference)
  expect(input).toStrictEqual({dict1: {key1: 'value3'}})

  input = JSON.parse(JSON.stringify(defaults))
  reference = JSON.parse(JSON.stringify(defaults))
  input.key2 = 'value3'
  input.dict1.key2 = 'value4'
  config.nullifyInstructions(input, reference)
  expect(input).toStrictEqual({key2: 'value3', dict1: {key2: 'value4'}})

})
