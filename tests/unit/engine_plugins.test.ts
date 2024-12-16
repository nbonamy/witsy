
import { vi, beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Browse from '../../src/plugins/browse'
import Tavily from '../../src/plugins/tavily'
import Python from '../../src/plugins/python'
import YouTube from '../../src/plugins/youtube'
import Nestor from '../../src/plugins/nestor'

vi.mock('../../src/vendor/tavily', async () => {
  const Tavily = vi.fn()
  Tavily.prototype.search = vi.fn(() => ({ results: [ 'page1' ] }))
  return { default: Tavily }
})

vi.mock('youtube-transcript', async () => {
  return { YoutubeTranscript: {
    fetchTranscript: vi.fn(() => [ { text: 'line1' } ])
  } }
})

vi.mock('ytv', async () => {
  return { default: {
    get_info: vi.fn(() => ({ title: 'title', channel_name: 'channel' }))
  } }
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
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
  store.config.plugins.youtube = {
    enabled: true,
  }
  store.config.plugins.nestor = {
    enabled: true,
  }
})

test('Browse Plugin', async () => {
  const browse = new Browse(store.config.plugins.browse)
  expect(browse.isEnabled()).toBe(true)
  expect(browse.getName()).toBe('extract_webpage_content')
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

test('YouTube Plugin', async () => {
  const youtube = new YouTube(store.config.plugins.youtube)
  expect(youtube.isEnabled()).toBe(true)
  expect(youtube.getName()).toBe('get_youtube_transcript')
  expect(youtube.getDescription()).not.toBeFalsy()
  expect(youtube.getPreparationDescription()).toBeFalsy()
  expect(youtube.getRunningDescription()).not.toBeFalsy()
  expect(youtube.getParameters()[0].name).toBe('url')
  expect(youtube.getParameters()[0].type).toBe('string')
  expect(youtube.getParameters()[0].description).not.toBeFalsy()
  expect(youtube.getParameters()[0].required).toBe(true)
  expect(await youtube.execute({ url: 'test' })).toStrictEqual({
    title: 'title',
    channel: 'channel',
    content: 'line1'
  })
})

test('Nestor Plugin', async () => {
  const nestor = new Nestor(store.config.plugins.nestor)
  expect(nestor.isEnabled()).toBe(true)
  expect(nestor.getName()).toBe('Nestor')
  expect(nestor.isMultiTool()).toBe(true)
  expect(await nestor.getTools()).toStrictEqual([
    { function: { name: 'tool1' }, description: 'description1' },
    { function: { name: 'tool2' }, description: 'description2' },
  ])
  expect(nestor.handlesTool('tool1')).toBe(true)
  expect(nestor.handlesTool('tool2')).toBe(true)
  expect(nestor.handlesTool('tool3')).toBe(false)
  expect(await nestor.execute({ tool: 'tool1', parameters: { arg: 'hello' } })).toStrictEqual({
    name: 'tool1',
    params: { arg: 'hello' }
  })
})
