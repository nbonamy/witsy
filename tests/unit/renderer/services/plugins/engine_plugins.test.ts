
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../../../../mocks/window'
import { createI18nMock } from '../../../../mocks'
import { store } from '../../../../../src/renderer/services/store'
import Image from '../../../../../src/renderer/services/plugins/image'
import Video from '../../../../../src/renderer/services/plugins/video'
import Browse from '../../../../../src/renderer/services/plugins/browse'
import Search from '../../../../../src/renderer/services/plugins/search'
import Python from '../../../../../src/renderer/services/plugins/python'
import YouTube from '../../../../../src/renderer/services/plugins/youtube'
import Memory from '../../../../../src/renderer/services/plugins/memory'
import Computer from '../../../../../src/renderer/services/plugins/computer'
import Mcp from '../../../../../src/renderer/services/plugins/mcp'
import { MultiToolPlugin, PluginExecutionContext } from 'multi-llm-ts'
import { HfInference } from '@huggingface/inference'
import { GoogleGenAI } from '@google/genai'
import { fal } from '@fal-ai/client'
import tavily from '../../../../../src/vendor/tavily'
import Perplexity from '@perplexity-ai/perplexity_ai'
import { Exa } from 'exa-js'
import Replicate from 'replicate'
import OpenAI from 'openai'

const context: PluginExecutionContext = {
  model: 'mock',
}

// @ts-expect-error mocking
global.fetch = vi.fn(async (url: string) => {
  if (url.endsWith('.pdf')) {
    return {
      url,
      ok: true,
      headers: {
        // @ts-expect-error mock
        get: () => 'application/pdf',
      },
      blob: () => new Blob([new TextEncoder().encode('pdf')], { type: 'application/pdf' })
    }
  } else {
    return {
      url,
      ok: true,
      headers: {
        // @ts-expect-error mock
        get: () => 'text/html; charset=UTF-8',
      },
      text: () => '<html><head><title>title</title></head><body>fetched_content</body></html>',
      json: () => ({
        web: {
          results: [
            { url: 'url1', title: 'title1', description: 'desc1' },
            { url: 'url2', title: 'title2', description: 'desc2' }
          ]
        }
      })
    }
  }
})


vi.mock('../../../../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

vi.mock('../../../../../src/renderer/services/download.ts', async () => {
  return {
    saveFileContents: vi.fn(() => 'file://file_saved'),
    download: vi.fn(() => 'file://file_downloaded'),
  }
})  

// exa
vi.mock('exa-js', async () => {
  const Exa = vi.fn()
  Exa.prototype.searchAndContents = vi.fn(() => ({ results: [
    { title: 'title', url: 'url', text: 'fetched_' }
  ] }))
  return { Exa }
})

// perplexity
vi.mock('@perplexity-ai/perplexity_ai', async () => {
  const Perplexity = vi.fn()
  Perplexity.prototype.search = {
    create: vi.fn(() => ({ results: [
      { title: 'title', url: 'url' }
    ] }))
  }
  return { default: Perplexity }
})

// tavily
vi.mock('../../../../../src/vendor/tavily', async () => {
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

// youtube transcript
// vi.mock('youtube-transcript-api', async () => {
//   const TranscriptClient = vi.fn()
//   TranscriptClient.prototype.ready = true
//   TranscriptClient.prototype.getTranscript = vi.fn(() => ({
//     tracks: [ { transcript: [ { text: 'line1' } ] } ],
//   }))
//   return { default: TranscriptClient }
// })
vi.mock('youtube-transcript-api', async () => {
  return { default: {
    getTranscript: vi.fn(() => ([ { text: 'line1' } ]))
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

// google
vi.mock('@google/genai', async () => {
  const GoogleGenAI = vi.fn()
  GoogleGenAI.prototype.models = {
    generateImages: vi.fn(() => ({
      generatedImages: [{
        image: {
          imageBytes: 'base64encodedimage',
        } 
      }]
    }))
  }
  return {
    GoogleGenAI,
    PersonGeneration: {
      ALLOW_ALL: ''
    }
  }
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

// fal.ai
vi.mock('@fal-ai/client', async () => {
  return {
    fal: {
      config: vi.fn(),
      subscribe: vi.fn((model) => {
        if (model.includes('image')) {
          return { data: { images: [ { url: 'http://fal.ai/image.jpg' } ] } }
        } else if (model.includes('video')) {
          return { data: { video: { url: 'http://fal.ai/video.mp4' } } }
        }
      })
    }
  }
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
    exaApiKey: '123',
    tavilyApiKey: '123',
    braveApiKey: '456',
    contentLength: 8
  }
  store.config.plugins.python = {
    enabled: true,
    binpath: 'python3',
  }
  store.config.plugins.youtube = {
    enabled: true,
  }
  store.config.plugins.image = {
    enabled: true,
    engine: 'openai',
    model: 'gpt-image-1',
  }
  store.config.plugins.video = {
    enabled: true,
    engine: 'replicate',
    model: 'video-model',
  }
  store.config.engines = {
    openai: { apiKey: 'test-api-key', models: { chat: [] }, model: {} },
    google: { apiKey: 'test-api-key', models: { chat: [] }, model: {} },
    huggingface: { apiKey: 'test-api-key', models: { chat: [] }, model: {} },
    replicate: { apiKey: 'test-api-key', models: { chat: [] }, model: {} },
    falai: { apiKey: 'test-api-key', models: { chat: [] }, model: {} }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Browse Plugin', async () => {
  const browse = new Browse(store.config.plugins.browse, 'test-workspace')
  expect(browse.isEnabled()).toBe(true)
  expect(browse.getName()).toBe('extract_webpage_content')
  expect(browse.getDescription()).not.toBeFalsy()
  expect(browse.getPreparationDescription()).toBe('plugins.browse.running')
  expect(browse.getRunningDescription()).toBe('plugins.browse.running')
  expect(browse.getCompletedDescription('', { url: 'url' }, { title: 'title', content: 'content' })).toBe('plugins.browse.completed_default_title=title')
  expect(browse.getCompletedDescription('', { url: 'url' }, { error: 'error' })).toBe('plugins.browse.error')
  expect(browse.getParameters()[0].name).toBe('url')
  expect(browse.getParameters()[0].type).toBe('string')
  expect(browse.getParameters()[0].description).not.toBeFalsy()
  expect(browse.getParameters()[0].required).toBe(true)
  expect(browse.getParameters()[1].name).toBe('search')
  expect(browse.getParameters()[1].required).toBe(false)
  expect(browse.getParameters()[2].name).toBe('maxChunks')
  expect(browse.getParameters()[2].required).toBe(false)
  expect(browse.getParameters()[3].name).toBe('chunkLength')
  expect(browse.getParameters()[3].required).toBe(false)
  expect(await browse.execute(context, { url: 'https://google.com' })).toStrictEqual({
    title: 'title',
    content: 'fetched_content'
  })
  expect(await browse.execute(context, { url: 'https://google.com/dummy.pdf' })).toStrictEqual({
    title: 'https://google.com/dummy.pdf',
    content: 'cGRm_extracted'
  })
})

test('Browse Plugin with search', async () => {
  const browse = new Browse(store.config.plugins.browse, 'test-workspace')
  const result = await browse.execute(context, { url: 'https://google.com', search: 'fetched' })
  expect(result.title).toBe('title')
  expect(result.content).toContain('fetched')
})

test('Browse Plugin with search and custom chunkLength', async () => {
  const browse = new Browse(store.config.plugins.browse, 'test-workspace')
  const result = await browse.execute(context, { url: 'https://google.com', search: 'content', chunkLength: 5 })
  expect(result.title).toBe('title')
  expect(result.content).toContain('content')
  expect(result.content).toContain('...')
})

test('Browse Plugin with maxChunks limit', async () => {
  const browse = new Browse(store.config.plugins.browse, 'test-workspace')
  const result = await browse.execute(context, { url: 'https://google.com', search: 'e', maxChunks: 2 })
  expect(result.title).toBe('title')
  expect(result.content).toContain('e')
  // Should limit to 2 chunks even if more matches exist
  const chunks = result.content.split('\n\n')
  expect(chunks.length).toBeLessThanOrEqual(2)
})

test('Search Plugin Local', async () => {
  const search = new Search(store.config.plugins.search, 'test-workspace')
  expect(search.isEnabled()).toBe(true)
  expect(search.getName()).toBe('search_internet')
  expect(search.getDescription()).not.toBeFalsy()
  expect(search.getPreparationDescription()).toBe('plugins.search.running')
  expect(search.getRunningDescription()).toBe('plugins.search.running')
  expect(search.getCompletedDescription('', { query: 'query' }, { results: [] })).toBe('plugins.search.completed_default_query=query&count=0')
  expect(search.getCompletedDescription('', { query: 'query' }, { results: [ {} ] })).toBe('plugins.search.completed_default_query=query&count=1')
  expect(search.getCompletedDescription('', { query: 'query' }, { error: 'error' })).toBe('plugins.search.error')
  expect(search.getParameters()[0].name).toBe('query')
  expect(search.getParameters()[0].type).toBe('string')
  expect(search.getParameters()[0].description).not.toBeFalsy()
  expect(search.getParameters()[0].required).toBe(true)
  expect(await search.execute(context, { query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title1', url: 'url1', content: 'page1_co' },
      { title: 'title2', url: 'url2', content: 'page2_co' }
    ],
  })
  expect(window.api.search.query).toHaveBeenLastCalledWith('test', 5, expect.any(String))
})

test('Search Plugin Brave', async () => {
  store.config.plugins.search.engine = 'brave'
  const search = new Search(store.config.plugins.search, 'test-workspace')
  expect(await search.execute(context, { query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { url: 'url1', title: 'title1', content: 'fetched_' },
      { url: 'url2', title: 'title2', content: 'fetched_' }
    ]
  })
  expect(fetch).toHaveBeenNthCalledWith(1, 'https://api.search.brave.com/res/v1/web/search?q=test&count=5', {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': store.config.plugins.search.braveApiKey
    }
  })
  expect(window.api.search.query).not.toHaveBeenCalled()
})

test('Search Plugin Exa', async () => {
  store.config.plugins.search.engine = 'exa'
  const search = new Search(store.config.plugins.search, 'test-workspace')
  expect(await search.execute(context, { query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title', url: 'url', content: 'fetched_' }
    ]
  })
  expect(Exa.prototype.searchAndContents).toHaveBeenLastCalledWith('test', { text: true, numResults: 5 })
  expect(window.api.search.query).not.toHaveBeenCalled()
})

test('Search Plugin Perplexity', async () => {
  store.config.plugins.search.engine = 'perplexity'
  const search = new Search(store.config.plugins.search, 'test-workspace')
  expect(await search.execute(context, { query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title', url: 'url', content: 'fetched_' }
    ]
  })
  expect(Perplexity.prototype.search.create).toHaveBeenLastCalledWith({ query: 'test', max_results: 5 })
  expect(window.api.search.query).not.toHaveBeenCalled()
})

test('Search Plugin Tavily', async () => {
  store.config.plugins.search.engine = 'tavily'
  const search = new Search(store.config.plugins.search, 'test-workspace')
  expect(await search.execute(context, { query: 'test' })).toStrictEqual({
    query: 'test',
    results: [
      { title: 'title', url: 'url', content: 'fetched_' }
    ]
  })
  expect(tavily.prototype.search).toHaveBeenLastCalledWith('test', { max_results: 5 })
  expect(window.api.search.query).not.toHaveBeenCalled()
})

test('Image Plugin', async () => {
  
  const image = new Image(store.config.plugins.image, 'test-workspace')
  expect(image.isEnabled()).toBe(true)
  expect(image.getName()).toBe('image_generation')
  expect(image.getDescription()).toBe('plugins.image.description_fr-FR')
  expect(image.getPreparationDescription()).toBe('plugins.image.running')
  expect(image.getRunningDescription()).toBe('plugins.image.running')
  expect(image.getCompletedDescription('', { prompt: 'prompt' }, { result: 'url' })).toBe('plugins.image.completed_default_engine=openai&model=gpt-image-1&prompt=prompt')
  expect(image.getCompletedDescription('', { prompt: 'prompt' }, { error: 'err' })).toBe('plugins.image.error')
  expect(image.getParameters()[0].name).toBe('prompt')
  expect(image.getParameters()[0].type).toBe('string')
  expect(image.getParameters()[0].description).not.toBeFalsy()
  expect(image.getParameters()[0].required).toBe(true)

})

test('Image Plugin OpenAI', async () => {

  store.config.plugins.image.engine = 'openai'
  store.config.plugins.image.model = 'gpt-image-1'
  const image = new Image(store.config.plugins.image, 'test-workspace')
  const result = await image.execute({ model: 'gpt-image-1' }, { prompt: 'test prompt' })
  expect(OpenAI.prototype.images.generate).toHaveBeenLastCalledWith(expect.objectContaining({
    model: 'gpt-image-1',
    prompt: 'test prompt',
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

  store.config.plugins.image.model = 'dall-e-2'
  await image.execute({ model: 'dall-e-2' }, { prompt: 'test prompt' })
  expect(OpenAI.prototype.images.generate).toHaveBeenLastCalledWith(expect.objectContaining({
    model: 'dall-e-2',
    prompt: 'test prompt',
    response_format: 'b64_json',
  }))
})

test('Image Plugin HuggingFace', async () => {

  store.config.plugins.image.engine = 'huggingface'
  store.config.plugins.image.model = 'test-model'
  const image = new Image(store.config.plugins.image, 'test-workspace')
  const result = await image.execute({ model: 'test-model' }, { prompt: 'test prompt' })
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
  store.config.plugins.image.model = 'image/model'
  const image = new Image(store.config.plugins.image, 'test-workspace')
  const result = await image.execute({ model: 'image/model' }, { prompt: 'test prompt' })
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

test('Image Plugin fal.ai', async () => {

  store.config.plugins.image.engine = 'falai'
  store.config.plugins.image.model = 'image/model'
  const image = new Image(store.config.plugins.image, 'test-workspace')
  const result = await image.execute({ model: 'image/model' }, { prompt: 'test prompt' })
  expect(fal.config).toHaveBeenLastCalledWith({ credentials: 'test-api-key' })
  expect(fal.subscribe).toHaveBeenLastCalledWith('image/model', expect.objectContaining({
    input: { prompt: 'test prompt', }
  }))
  expect(result).toStrictEqual({
    url: 'file://file_downloaded',
  })

})

test('Image Plugin google', async () => {

  store.config.plugins.image.engine = 'google'
  store.config.plugins.image.model = 'image/model'
  const image = new Image(store.config.plugins.image, 'test-workspace')
  const result = await image.execute({ model: 'image/model' }, { prompt: 'test prompt' })
  expect(GoogleGenAI.prototype.models.generateImages).toHaveBeenLastCalledWith({
    model: 'image/model',
    prompt: 'test prompt',
    config: expect.any(Object),
  })
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Video Plugin', async () => {
  
  const video = new Video(store.config.plugins.video, 'test-workspace')
  expect(video.isEnabled()).toBe(true)
  expect(video.getName()).toBe('video_generation')
  expect(video.getDescription()).toBe('plugins.video.description_fr-FR')
  expect(video.getPreparationDescription()).toBe('plugins.video.running')
  expect(video.getRunningDescription()).toBe('plugins.video.running')
  expect(video.getCompletedDescription('', { prompt: 'prompt' }, { result: 'url' })).toBe('plugins.video.completed_default_engine=replicate&model=video-model&prompt=prompt')
  expect(video.getCompletedDescription('', { prompt: 'prompt' }, { error: 'err' })).toBe('plugins.video.error')
  expect(video.getParameters()[0].name).toBe('prompt')
  expect(video.getParameters()[0].type).toBe('string')
  expect(video.getParameters()[0].description).not.toBeFalsy()
  expect(video.getParameters()[0].required).toBe(true)

  store.config.plugins.video.description = 'test description'
  expect(video.getDescription()).toBe('test description')

})

test('Video Plugin Replicate', async () => {
  
  store.config.plugins.video.engine = 'replicate'
  store.config.plugins.video.model = 'video/model'
  const video = new Video(store.config.plugins.video, 'test-workspace')
  const result = await video.execute({ model: 'video/model' }, { prompt: 'test prompt' })
  expect(Replicate.prototype.run).toHaveBeenLastCalledWith('video/model', expect.objectContaining({
    input: {
      prompt: 'test prompt',
    }
  }))
  expect(result).toStrictEqual({
    url: 'file://file_saved',
  })

})

test('Video Plugin fal.ai', async () => {

  store.config.plugins.video.engine = 'falai'
  store.config.plugins.video.model = 'video/model'
  const video = new Video(store.config.plugins.video, 'test-workspace')
  const result = await video.execute({ model: 'video/model' }, { prompt: 'test prompt' })
  expect(fal.config).toHaveBeenLastCalledWith({ credentials: 'test-api-key' })
  expect(fal.subscribe).toHaveBeenLastCalledWith('video/model', expect.objectContaining({
    input: { prompt: 'test prompt', }
  }))
  expect(result).toStrictEqual({
    url: 'file://file_downloaded',
  })

})

test('Python Plugin', async () => {
  const python = new Python(store.config.plugins.python, 'test-workspace')
  expect(python.isEnabled()).toBe(true)
  expect(python.getName()).toBe('run_python_code')
  expect(python.getDescription()).not.toBeFalsy()
  expect(python.getPreparationDescription()).toBe('plugins.python.running')
  expect(python.getRunningDescription()).toBe('plugins.python.running')
  expect(python.getCompletedDescription('', { script: 'script' }, { result: 'result' })).toBe('plugins.python.completed_default_result=result')
  expect(python.getCompletedDescription('', { script: 'script' }, { error: 'error' })).toBe('plugins.python.error_default_error=error')
  expect(python.getParameters()[0].name).toBe('script')
  expect(python.getParameters()[0].type).toBe('string')
  expect(python.getParameters()[0].description).not.toBeFalsy()
  expect(python.getParameters()[0].required).toBe(true)
  expect(await python.execute(context, { script: 'print("hello")' })).toHaveProperty('result')
  expect((await python.execute(context, { script: 'print("hello")' })).result).toBe('bonjour')
})

test('YouTube Plugin', async () => {
  const youtube = new YouTube(store.config.plugins.youtube, 'test-workspace')
  expect(youtube.isEnabled()).toBe(true)
  expect(youtube.getName()).toBe('get_youtube_transcript')
  expect(youtube.getDescription()).not.toBeFalsy()
  expect(youtube.getPreparationDescription()).toBe('plugins.youtube.running')
  expect(youtube.getRunningDescription()).toBe('plugins.youtube.running')
  expect(youtube.getCompletedDescription('', { url: 'url' }, { content: 'transcript', title: 'title' })).toBe('plugins.youtube.completed_default_title=title')
  expect(youtube.getCompletedDescription('', { url: 'url' }, { content: '', title: 'title' })).toBe('plugins.youtube.error')
  expect(youtube.getCompletedDescription('', { url: 'url' }, { error: 'error' })).toBe('plugins.youtube.error')
  expect(youtube.getParameters()[0].name).toBe('url')
  expect(youtube.getParameters()[0].type).toBe('string')
  expect(youtube.getParameters()[0].description).not.toBeFalsy()
  expect(youtube.getParameters()[0].required).toBe(true)
  expect(await youtube.execute(context, { url: 'test' })).toStrictEqual({
    title: 'title',
    channel: 'channel',
    content: 'line1'
  })
})

test('Memory Plugin', async () => {
  const memory = new Memory(store.config.plugins.memory, 'test-workspace')
  expect(memory.isEnabled()).toBe(false)
  expect(memory.getName()).toBe('long_term_memory')
  expect(memory.getDescription()).toBe('plugins.memory.description_fr-FR')
  expect(memory.getPreparationDescription()).toBe('plugins.memory.starting')
  expect(memory.getRunningDescription('', { action: 'store', content: [ 'fact1', 'fact2' ] })).toBe('plugins.memory.storing_default_content=["fact1","fact2"]')
  expect(memory.getRunningDescription('', { action: 'retrieve', query: 'query' })).toBe('plugins.memory.retrieving_default_query=query')
  expect(memory.getCompletedDescription('', { action: 'store', content: [ 'fact1', 'fact2' ] }, { success: true })).toBe('plugins.memory.stored')
  expect(memory.getCompletedDescription('', { action: 'store', content: [ 'fact1', 'fact2' ] }, { error: 'error' })).toBe('plugins.memory.error')
  expect(memory.getCompletedDescription('', { action: 'retrieve', query: 'query' }, { content: ['fact1'] })).toBe('plugins.memory.retrieved_default_count=1')
  expect(memory.getCompletedDescription('', { action: 'retrieve', query: 'query' }, { error: 'error' })).toBe('plugins.memory.error')
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
  expect(await memory.execute(context, { action: 'store', content: ['test'] })).toStrictEqual({ success: true })
  expect(window.api.memory.store).toHaveBeenLastCalledWith(['test'])
  expect(await memory.execute(context, { action: 'retrieve', query: 'fact' })).toStrictEqual({ content: ['fact1'] })
  expect(window.api.memory.retrieve).toHaveBeenLastCalledWith('fact')
  expect(await memory.execute(context, { action: 'retrieve', query: 'fiction' })).toStrictEqual({ error: 'No relevant information found' })
  expect(window.api.memory.retrieve).toHaveBeenCalledTimes(2)
})

test('Computer Plugin', async () => {

  // basic stuff
  const computer = new Computer(store.config.plugins.computer, 'test-workspace')
  expect(computer.isEnabled()).toBe(true)
  expect(computer.getName()).toBe('computer')
  expect(computer.getDescription()).toBe('')
  expect(computer.getPreparationDescription()).toBe('Using your computer…')
  expect(computer.getRunningDescription()).toBe('Using your computer…')
  expect(computer.getParameters()).toStrictEqual([])

  // all actions should return a screenshot
  const result = await computer.execute(context, { action: 'whatever' })
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

test('MCP Plugin', async () => {
  
  const mcp = new Mcp(store.config.mcp, 'test-workspace')
  expect(mcp.isEnabled()).toBe(true)
  expect(mcp).toBeInstanceOf(MultiToolPlugin)
  expect(mcp.getName()).toBe('Model Context Protocol')
  expect(mcp.getPreparationDescription('tool')).toBe('plugins.mcp.starting_default_tool=tool')
  expect(mcp.getRunningDescription('tool', {})).toBe('plugins.mcp.running_default_tool=tool')
  expect(mcp.getCompletedDescription('tool', {}, { result: 'result' })).toBe('plugins.mcp.completed_default_tool=tool&args={}&results={"result":"result"}')
  expect(mcp.getCompletedDescription('tool', {}, { error: 'error' })).toBe('plugins.mcp.error_default_tool=tool&error=error')

  expect(await mcp.getTools()).toStrictEqual([
    { type: 'function', function: { name: 'tool1' , description: 'description1', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'tool2' , description: 'description2', parameters: { type: 'object', properties: {}, required: [] } } },
  ])
  
  expect(mcp.handlesTool('tool1')).toBe(true)
  expect(mcp.handlesTool('tool2')).toBe(true)
  expect(mcp.handlesTool('tool3')).toBe(false)
  
  expect(await mcp.execute(context, {
    tool: 'tool1',
    parameters: { param1: 'value1' }
  })).toStrictEqual({ result: 'result' })
  expect(window.api.mcp.callTool).toHaveBeenLastCalledWith('tool1', { param1: 'value1' }, expect.any(String))
  
  expect(await mcp.execute(context, {
    tool: 'tool2',
    parameters: { param1: 'value1' }
  })).toStrictEqual({ result: 'result2' })

  mcp.enableTool('tool1')
  expect(await mcp.getTools()).toStrictEqual([
    { type: 'function', function: { name: 'tool1' , description: 'description1', parameters: { type: 'object', properties: {}, required: [] } } },
  ])

  expect(mcp.handlesTool('tool1')).toBe(true)
  expect(mcp.handlesTool('tool2')).toBe(false)
  expect(mcp.handlesTool('tool3')).toBe(false)

  expect(await mcp.execute(context, {
    tool: 'tool2',
    parameters: { param1: 'value1' }
  })).toStrictEqual({ error: 'Tool tool2 is not handled by this plugin or has been disabled' })

})
