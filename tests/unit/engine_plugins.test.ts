
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Browse from '../../src/plugins/browse'
import Tavily from '../../src/plugins/tavily'
import Python from '../../src/plugins/python'

vi.mock('../../src/vendor/tavily', async () => {
  const Tavily = vi.fn()
  Tavily.prototype.search = vi.fn(() => ({ results: [ 'page1' ] }))
  return { default: Tavily }
})

window.api = {
  interpreter: {
    python: vi.fn(() => ({ result: ['bonjour'] }))
  }
}

beforeEach(() => {
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.plugins.browse = {
    enabled: true,
  }
  store.config.plugins.tavily = {
    enabled: true,
    apiKey: '123',
  }
  store.config.plugins.python = {
    enabled: true,
    binpath: 'python3',
  }
})

test('Browse Plugin', async () => {
  const browse = new Browse(store.config.plugins.browse)
  expect(browse.isEnabled()).toBe(true)
  expect(browse.getName()).toBe('get_html_as_text')
  expect(browse.getDescription()).not.toBeFalsy()
  expect(browse.getPreparationDescription()).toBeFalsy()
  expect(browse.getRunningDescription()).not.toBeFalsy()
  expect(browse.getParameters()[0].name).toBe('url')
  expect(browse.getParameters()[0].type).toBe('string')
  expect(browse.getParameters()[0].description).not.toBeFalsy()
  expect(browse.getParameters()[0].required).toBe(true)
  expect(await browse.execute({ url: 'https://google.com' })).toHaveProperty('content')
})

test('Tavily Plugin', async () => {
  const tavily = new Tavily(store.config.plugins.tavily)
  expect(tavily.isEnabled()).toBe(true)
  expect(tavily.getName()).toBe('search_tavily')
  expect(tavily.getDescription()).not.toBeFalsy()
  expect(tavily.getPreparationDescription()).toBeFalsy()
  expect(tavily.getRunningDescription()).not.toBeFalsy()
  expect(tavily.getParameters()[0].name).toBe('query')
  expect(tavily.getParameters()[0].type).toBe('string')
  expect(tavily.getParameters()[0].description).not.toBeFalsy()
  expect(tavily.getParameters()[0].required).toBe(true)
  expect(await tavily.execute({ query: 'test' })).toHaveProperty('results')
})

test('Python Plugin', async () => {
  const python = new Python(store.config.plugins.python)
  expect(python.isEnabled()).toBe(true)
  expect(python.getName()).toBe('run_python_code')
  expect(python.getDescription()).not.toBeFalsy()
  expect(python.getPreparationDescription()).not.toBeFalsy()
  expect(python.getRunningDescription()).not.toBeFalsy()
  expect(python.getParameters()[0].name).toBe('script')
  expect(python.getParameters()[0].type).toBe('string')
  expect(python.getParameters()[0].description).not.toBeFalsy()
  expect(python.getParameters()[0].required).toBe(true)
  expect(await python.execute({ script: 'print("hello")' })).toHaveProperty('result')
  expect((await python.execute({ script: 'print("hello")' })).result).toBe('bonjour')
})
