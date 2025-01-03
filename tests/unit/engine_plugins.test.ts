
import { vi, beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Image from '../../src/plugins/image'
import Video from '../../src/plugins/video'
import Browse from '../../src/plugins/browse'
import Tavily from '../../src/plugins/tavily'
import Python from '../../src/plugins/python'
import YouTube from '../../src/plugins/youtube'
import Memory from '../../src/plugins/memory'
import Nestor from '../../src/plugins/nestor'
import Computer from '../../src/plugins/computer'
import { HfInference } from '@huggingface/inference'
import Replicate from 'replicate'
import OpenAI from 'openai'

vi.mock('../services/download', () => ({
  saveFileContents: vi.fn(() => 'file_url')
}))

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

vi.mock('openai', async () => {
  const OpenAI = vi.fn()
  OpenAI.prototype.images = {
    generate: vi.fn(() =>  ({ data: [{ b64_json: 'base64encodedimage' }] }))
  }
  return { default : OpenAI }
})

vi.mock('@huggingface/inference', async () => {
  const HfInference = vi.fn()
  HfInference.prototype.textToImage = vi.fn(() => new Blob(['image'], { type: 'image/jpeg' }))
  return { HfInference }
})

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
  store.config.engines = {
    openai: { apiKey: 'test-api-key', model: { image: 'dall-e-2' } },
    huggingface: { apiKey: 'test-api-key', model: { image: 'test-model' } },
    replicate: { apiKey: 'test-api-key', model: { image: 'test-model' } }
  }
})

test('Image Plugin', async () => {
  
  const image = new Image(store.config.plugins.image)
  expect(image.isEnabled()).toBe(true)
  expect(image.getName()).toBe('image_generation')
  expect(image.getDescription()).not.toBeFalsy()
  expect(image.getPreparationDescription()).toBe(image.getRunningDescription())
  expect(image.getRunningDescription()).toBe('Painting pixels…')
  expect(image.getParameters()[0].name).toBe('prompt')
  expect(image.getParameters()[0].type).toBe('string')
  expect(image.getParameters()[0].description).not.toBeFalsy()
  expect(image.getParameters()[0].required).toBe(true)

  // openai
  vi.clearAllMocks()
  store.config.plugins.image.engine = 'openai'
  const result1 = await image.execute({ prompt: 'test prompt' })
  expect(OpenAI.prototype.images.generate).toHaveBeenCalledWith(expect.objectContaining({
    model: 'dall-e-2',
    prompt: 'test prompt',
    response_format: 'b64_json',
  }))
  expect(result1).toStrictEqual({
    url: 'file_url',
    description: 'test prompt'
    
  })

  // hugging face
  vi.clearAllMocks()
  store.config.plugins.image.engine = 'huggingface'
  const result2 = await image.execute({ prompt: 'test prompt' })
  expect(HfInference.prototype.textToImage).toHaveBeenCalledWith(expect.objectContaining({
    model: 'test-model',
    inputs: 'test prompt',
  }))
  expect(result2).toStrictEqual({
    url: 'file_url',
    description: 'test prompt'
  })

  // replicate
  vi.clearAllMocks()
  store.config.plugins.image.engine = 'replicate'
  store.config.engines.replicate.model.image = 'image/model'
  const result3 = await image.execute({ prompt: 'test prompt' })
  expect(Replicate.prototype.run).toHaveBeenCalledWith('image/model', expect.objectContaining({
    input: {
      prompt: 'test prompt',
      output_format: 'jpg',
    }
  }))
  expect(result3).toStrictEqual({
    url: 'file_url',
    description: 'test prompt'
  })
})

test('Video Plugin', async () => {
  
  const video = new Video(store.config.plugins.video)
  expect(video.isEnabled()).toBe(true)
  expect(video.getName()).toBe('video_generation')
  expect(video.getDescription()).not.toBeFalsy()
  expect(video.getPreparationDescription()).toBe(video.getRunningDescription())
  expect(video.getRunningDescription()).toBe('Animating frames…')
  expect(video.getParameters()[0].name).toBe('prompt')
  expect(video.getParameters()[0].type).toBe('string')
  expect(video.getParameters()[0].description).not.toBeFalsy()
  expect(video.getParameters()[0].required).toBe(true)

  // replicate
  vi.clearAllMocks()
  store.config.plugins.video.engine = 'replicate'
  store.config.engines.replicate.model.video = 'video/model'
  const result3 = await video.execute({ prompt: 'test prompt' })
  expect(Replicate.prototype.run).toHaveBeenCalledWith('video/model', expect.objectContaining({
    input: {
      prompt: 'test prompt',
    }
  }))
  expect(result3).toStrictEqual({
    url: 'file_url',
    description: 'test prompt'
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
  expect(await browse.execute({ url: 'https://google.com' })).toHaveProperty('content')
})

test('Tavily Plugin', async () => {
  const tavily = new Tavily(store.config.plugins.tavily)
  expect(tavily.isEnabled()).toBe(true)
  expect(tavily.getName()).toBe('search_tavily')
  expect(tavily.getDescription()).not.toBeFalsy()
  expect(tavily.getPreparationDescription()).toBe('Searching the internet…')
  expect(tavily.getRunningDescription()).toBe('Searching the internet…')
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
  expect(memory.getDescription()).not.toBeFalsy()
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