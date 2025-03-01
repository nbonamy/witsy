
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Image from '../../src/plugins/image'
import Video from '../../src/plugins/video'
import Browse from '../../src/plugins/browse'
import Search from '../../src/plugins/search'
import Python from '../../src/plugins/python'
import YouTube from '../../src/plugins/youtube'
import Memory from '../../src/plugins/memory'
import Nestor from '../../src/plugins/nestor'
import Computer from '../../src/plugins/computer'
import { HfInference } from '@huggingface/inference'
import Replicate from 'replicate'
import OpenAI from 'openai'

// @ts-expect-error mocking
global.fetch = vi.fn(async () => ({
  text: () => 'fetched_content',
}))

// mock i18n
vi.mock('../../src/services/i18n', async () => {
  return {
    i18nInstructions: (config: any, key: string) => {

      // get instructions
      const instructions = key.split('.').reduce((obj, token) => obj?.[token], config)
      if (typeof instructions === 'string' && (instructions as string)?.length) {
        return instructions
      }

      // default
      return `${key}.${store.config.llm.locale}`

    }
  }
})

// tavily
vi.mock('../../src/vendor/tavily', async () => {
  const Tavily = vi.fn()
  Tavily.prototype.search = vi.fn(() => ({ results: [
    { title: 'title', url: 'url', content: 'content' }
  ] }))
  return { default: Tavily }
})

// youtube transcript
vi.mock('youtube-transcript', async () => {
  return { YoutubeTranscript: {
    fetchTranscript: vi.fn(() => [ { text: 'line1' } ])
  } }
})

// youtube info
vi.mock('ytv', async () => {
  return { default: {
    get_info: vi.fn(() => ({ title: 'title', channel_name: 'channel' }))
  } }
})

// openai
vi.mock('openai', async () => {
  const OpenAI = vi.fn()
  OpenAI.prototype.images = {
    generate: vi.fn(() =>  ({ data: [{ b64_json: 'base64encodedimage' }] }))
  }
  return { default : OpenAI }
})

// huggingface
vi.mock('@huggingface/inference', async () => {
  const HfInference = vi.fn()
  HfInference.prototype.textToImage = vi.fn(() => new Blob(['image'], { type: 'image/jpeg' }))
  return { HfInference }
})

// replicate
vi.mock('replicate', async () => {
  const Replicate = vi.fn()
  Replicate.prototype.run = vi.fn((model) => {
    if (model.includes('image')) {
      return [{ blob: () => new Blob(['image'], { type: 'image/jpeg' }) }]
    } else {
      return [{ blob: () => new Blob(['video'], { type: 'video/mp4' }) }]
    }
  })
  return { default: Replicate }
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.config.llm.locale = 'fr-FR'
  store.config.llm.engine = 'mock'
  store.config.plugins.browse = {
    enabled: true,
  }
  store.config.plugins.search = {
    enabled: true,
    engine: 'local',
    tavilyApiKey: '123',
    contentLength: 8
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
  store.config.engines = {
    openai: { apiKey: 'test-api-key', model: { image: 'dall-e-2' } },
    huggingface: { apiKey: 'test-api-key', model: { image: 'test-model' } },
    replicate: { apiKey: 'test-api-key', model: { image: 'test-model' } }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Image Plugin', async () => {
  
  const image = new Image(store.config.plugins.image)
  expect(image.isEnabled()).toBe(true)
  expect(image.getName()).toBe('image_generation')
  expect(image.getDescription()).toBe('plugins.image.description.fr-FR')
  expect(image.getPreparationDescription()).toBe(image.getRunningDescription())
  expect(image.getRunningDescription()).toBe('Painting pixels…')
  expect(image.getParameters()[0].name).toBe('prompt')
  expect(image.getParameters()[0].type).toBe('string')
  expect(image.getParameters()[0].description).not.toBeFalsy()
  expect(image.getParameters()[0].required).toBe(true)

})

test('Image Plugin OpenAI', async () => {

  store.config.plugins.image.engine = 'openai'
  const image = new Image(store.config.plugins.image)
  const result = await image.execute({ prompt: 'test prompt' })
  expect(OpenAI.prototype.images.generate).toHaveBeenLastCalledWith(expect.objectContaining({
    model: 'dall-e-2',
    prompt: 'test prompt',
    response_format: 'b64_json',
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Image Plugin HuggingFace', async () => {

  store.config.plugins.image.engine = 'huggingface'
  const image = new Image(store.config.plugins.image)
  const result = await image.execute({ prompt: 'test prompt' })
  expect(HfInference.prototype.textToImage).toHaveBeenLastCalledWith(expect.objectContaining({
    model: 'test-model',
    inputs: 'test prompt',
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Image Plugin Replicate', async () => {

  store.config.plugins.image.engine = 'replicate'
  store.config.engines.replicate.model.image = 'image/model'
  const image = new Image(store.config.plugins.image)
  const result = await image.execute({ prompt: 'test prompt' })
  expect(Replicate.prototype.run).toHaveBeenLastCalledWith('image/model', expect.objectContaining({
    input: {
      prompt: 'test prompt',
      output_format: 'jpg',
    }
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Video Plugin', async () => {
  
  const video = new Video(store.config.plugins.video)
  expect(video.isEnabled()).toBe(true)
  expect(video.getName()).toBe('video_generation')
  expect(video.getDescription()).toBe('plugins.video.description.fr-FR')
  expect(video.getPreparationDescription()).toBe(video.getRunningDescription())
  expect(video.getRunningDescription()).toBe('Animating frames…')
  expect(video.getParameters()[0].name).toBe('prompt')
  expect(video.getParameters()[0].type).toBe('string')
  expect(video.getParameters()[0].description).not.toBeFalsy()
  expect(video.getParameters()[0].required).toBe(true)

  store.config.plugins.video.description = 'test description'
  expect(video.getDescription()).toBe('test description')

})

test('Video Plugin Replicate', async () => {
  
  store.config.plugins.video.engine = 'replicate'
  store.config.engines.replicate.model.video = 'video/model'
  const video = new Video(store.config.plugins.video)
  const result = await video.execute({ prompt: 'test prompt' })
  expect(Replicate.prototype.run).toHaveBeenLastCalledWith('video/model', expect.objectContaining({
    input: {
      prompt: 'test prompt',
    }
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Browse Plugin', async () => {
  const browse = new Browse(store.config.plugins.browse)
  expect(browse.isEnabled()).toBe(true)
  expect(browse.getName()).toBe('extract_webpage_content')
  expect(browse.getDescription()).not.toBeFalsy()
  expect(browse.getPreparationDescription()).toBe('Downloading content…')
  expect(browse.getRunningDescription()).toBe('Downloading content…')
  expect(browse.getParameters()[0].name).toBe('url')
  expect(browse.getParameters()[0].type).toBe('string')
  expect(browse.getParameters()[0].description).not.toBeFalsy()
  expect(browse.getParameters()[0].required).toBe(true)
  expect(await browse.execute({ url: 'https://google.com' })).toStrictEqual({ content: 'fetched_content' })
})

test('Search Plugin Local', async () => {
  const search = new Search(store.config.plugins.search)
  expect(search.isEnabled()).toBe(true)
  expect(search.getName()).toBe('search_internet')
  expect(search.getDescription()).not.toBeFalsy()
  expect(search.getPreparationDescription()).toBe('Searching the internet…')
  expect(search.getRunningDescription()).toBe('Searching the internet…')
  expect(search.getParameters()[0].name).toBe('query')
  expect(search.getParameters()[0].type).toBe('string')
  expect(search.getParameters()[0].description).not.toBeFalsy()
  expect(search.getParameters()[0].required).toBe(true)
  expect(await search.execute({ query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title1', url: 'url1', content: 'page_con' },
      { title: 'title2', url: 'url2', content: 'page_con' }
    ]
  })
  expect(window.api.search.query).toHaveBeenLastCalledWith('test', 5)
})

test('Search Plugin Tavily', async () => {
  store.config.plugins.search.engine = 'tavily'
  const search = new Search(store.config.plugins.search)
  expect(await search.execute({ query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title', url: 'url', content: 'fetched_' }
    ]
  })
  expect(window.api.search.query).not.toHaveBeenCalled()
})

test('Python Plugin', async () => {
  const python = new Python(store.config.plugins.python)
  expect(python.isEnabled()).toBe(true)
  expect(python.getName()).toBe('run_python_code')
  expect(python.getDescription()).not.toBeFalsy()
  expect(python.getPreparationDescription()).toBe('Executing code…')
  expect(python.getRunningDescription()).toBe('Executing code…')
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
  expect(youtube.getPreparationDescription()).toBe('Downloading transcript…')
  expect(youtube.getRunningDescription()).toBe('Downloading transcript…')
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

test('Memory Plugin', async () => {
  const memory = new Memory(store.config.plugins.memory)
  expect(memory.isEnabled()).toBe(false)
  expect(memory.getName()).toBe('long_term_memory')
  expect(memory.getDescription()).toBe('plugins.memory.description.fr-FR')
  expect(memory.getPreparationDescription()).toBe('Personnalizing…')
  expect(memory.getRunningDescription()).toBe('Personnalizing…')
  expect(memory.getParameters()[0].name).toBe('action')
  expect(memory.getParameters()[0].type).toBe('string')
  expect(memory.getParameters()[0].enum).toStrictEqual(['store', 'retrieve'])
  expect(memory.getParameters()[0].description).not.toBeFalsy()
  expect(memory.getParameters()[0].required).toBe(true)
  expect(memory.getParameters()[1].name).toBe('content')
  expect(memory.getParameters()[1].type).toBe('array')
  expect(memory.getParameters()[1].items!.type).toBe('string')
  expect(memory.getParameters()[1].description).not.toBeFalsy()
  expect(memory.getParameters()[1].required).toBe(false)
  expect(memory.getParameters()[2].name).toBe('query')
  expect(memory.getParameters()[2].type).toBe('string')
  expect(memory.getParameters()[2].description).not.toBeFalsy()
  expect(memory.getParameters()[2].required).toBe(false)
  expect(await memory.execute({ action: 'store', content: ['test'] })).toStrictEqual({ success: true })
  expect(window.api.memory.store).toHaveBeenLastCalledWith(['test'])
  expect(await memory.execute({ action: 'retrieve', query: 'fact' })).toStrictEqual({ content: ['fact1'] })
  expect(window.api.memory.retrieve).toHaveBeenLastCalledWith('fact')
  expect(await memory.execute({ action: 'retrieve', query: 'fiction' })).toStrictEqual({ error: 'No relevant information found' })
  expect(window.api.memory.retrieve).toHaveBeenCalledTimes(2)
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

test('Computer Plugin', async () => {

  // basic stuff
  const computer = new Computer(store.config.plugins.computer)
  expect(computer.isEnabled()).toBe(true)
  expect(computer.getName()).toBe('computer')
  expect(computer.getDescription()).toBe('')
  expect(computer.getPreparationDescription()).toBe('Using your computer…')
  expect(computer.getRunningDescription()).toBe('Using your computer…')
  expect(computer.getParameters()).toStrictEqual([])

  // all actions should return a screenshot
  const result = await computer.execute({ action: 'whatever' })
  expect(window.api.computer.takeScreenshot).toHaveBeenCalled()
  expect(result).toStrictEqual({
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: 'screenshot_url'
        }
      }
    ]
  })
})
