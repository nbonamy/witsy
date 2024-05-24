
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Message from '../../src/models/message'
import Google from '../../src/services/google'
import { loadGoogleModels } from '../../src/services/llm'
import { EnhancedGenerateContentResponse, FunctionCall, FinishReason } from '@google/generative-ai'
import * as _Google from '@google/generative-ai'

vi.mock('@google/generative-ai', async() => {
  const GoogleChat = vi.fn()
  GoogleChat.prototype.sendMessage = vi.fn(() => { return { response: { text: () => 'response' } } })
  GoogleChat.prototype.sendMessageStream = vi.fn(() => { return { stream: vi.fn() } })
  const GoogleModel = vi.fn()
  GoogleModel.prototype.startChat = vi.fn(() => new GoogleChat())
  const GoogleGenerativeAI = vi.fn()
  GoogleGenerativeAI.prototype.apiKey = '123'
  GoogleGenerativeAI.prototype.getGenerativeModel = vi.fn(() => new GoogleModel())
  return { GoogleGenerativeAI, GoogleModel, GoogleChat, default: GoogleGenerativeAI }
})

beforeAll(() => {
  store.config = defaults
  store.config.engines.google.apiKey = '123'
  store.config.engines.google.model.chat = 'models/gemini-1.5-pro-latest'
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Google Load Models', async () => {
  expect(await loadGoogleModels()).toBe(true)
  const models = store.config.engines.google.models.chat
  expect(models.map((m: Model) => { return { id: m.id, name: m.name }})).toStrictEqual([
    { id: 'models/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini  1.5 Flash' },
    { id: 'models/gemini-pro', name: 'Gemini 1.0 Pro' },
  ])
  expect(store.config.engines.google.model.chat).toStrictEqual(models[0].id)
})

test('Google Basic', async () => {
  const google = new Google(store.config)
  expect(google.getName()).toBe('google')
  expect(google.isVisionModel('models/gemini-pro')).toBe(false)
  expect(google.isVisionModel('gemini-1.5-flash-latest')).toBe(true)
  expect(google.isVisionModel('models/gemini-1.5-pro-latest')).toBe(true)
})

test('Google completion', async () => {
  const google = new Google(store.config)
  const response = await google.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_Google.GoogleGenerativeAI).toHaveBeenCalled()
  expect(_Google.GoogleGenerativeAI.prototype.getGenerativeModel).toHaveBeenCalled()
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: []})
  expect(_Google.GoogleChat.prototype.sendMessage).toHaveBeenCalledWith(['prompt'])
  expect(response).toStrictEqual({
    type: 'text',
    content: 'response'
  })
})

test('Google stream', async () => {
  const google = new Google(store.config)
  const response = await google.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt'),
  ], null)
  expect(_Google.GoogleGenerativeAI).toHaveBeenCalled()
  expect(_Google.GoogleGenerativeAI.prototype.getGenerativeModel).toHaveBeenCalled()
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: []})
  expect(_Google.GoogleChat.prototype.sendMessageStream).toHaveBeenCalledWith(['prompt'])
  await google.stop(response)
  //expect(response.controller.abort).toHaveBeenCalled()
})

test('Google streamChunkToLlmChunk Text', async () => {
  const google = new Google(store.config)
  const streamChunk: EnhancedGenerateContentResponse = {
    candidates: [ {
      index: 0,
      content: { role: 'model', parts: [ { text: 'response' } ] },
      //finishReason: FinishReason.STOP,
    } ],
    text: vi.fn(() => 'response'),
    functionCalls: vi.fn((): FunctionCall[] => []),
    functionCall: null,
  }
  const llmChunk1 = await google.streamChunkToLlmChunk(streamChunk, null)
  expect(streamChunk.text).toHaveBeenCalled()
  //expect(streamChunk.functionCalls).toHaveBeenCalled()
  expect(llmChunk1).toStrictEqual({ text: 'response', done: false })
  streamChunk.candidates[0].finishReason = 'STOP' as FinishReason
  streamChunk.text = vi.fn(() => '')
  const llmChunk2 = await google.streamChunkToLlmChunk(streamChunk, null)
  expect(streamChunk.text).toHaveBeenCalled()
  //expect(streamChunk.functionCalls).toHaveBeenCalled()
  expect(llmChunk2).toStrictEqual({ text: '', done: true })
})

test('Google History Complete', async () => {
  const google = new Google(store.config)
  await google.complete([
    new Message('system', 'instruction'),
    new Message('user', 'prompt1'),
    new Message('assistant', 'response1'),
    new Message('user', 'prompt2'),
  ], null)
  expect(_Google.GoogleGenerativeAI.prototype.getGenerativeModel).toHaveBeenCalledWith({
    model: 'models/gemini-1.5-pro-latest',
    systemInstruction: 'instruction',
  }, { apiVersion: 'v1beta' })
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: [
    { role: 'user', parts: [ { text: 'prompt1' } ] },
    { role: 'model', parts: [ { text: 'response1' } ] },
  ]})
  expect(_Google.GoogleChat.prototype.sendMessage).toHaveBeenCalledWith(['prompt2'])
})

test('Google History Stream', async () => {
  const google = new Google(store.config)
  await google.stream([
    new Message('system', 'instruction'),
    new Message('user', 'prompt1'),
    new Message('assistant', 'response1'),
    new Message('user', 'prompt2'),
  ], null)
  expect(_Google.GoogleGenerativeAI.prototype.getGenerativeModel).toHaveBeenCalledWith({
    model: 'models/gemini-1.5-pro-latest',
    systemInstruction: 'instruction',
  }, { apiVersion: 'v1beta' })
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: [
    { role: 'user', parts: [ { text: 'prompt1' } ] },
    { role: 'model', parts: [ { text: 'response1' } ] },
  ]})
  expect(_Google.GoogleChat.prototype.sendMessageStream).toHaveBeenCalledWith(['prompt2'])
})

test('Google Text Attachments', async () => {
  const google = new Google(store.config)
  await google.stream([
    new Message('system', 'instruction'),
    new Message('user', { role: 'user', type: 'text', content: 'prompt1', attachment: { url: '', format: 'txt', contents: 'text1', downloaded: true } } ),
    new Message('assistant', 'response1'),
    new Message('user', { role: 'user', type: 'text', content: 'prompt2', attachment: { url: '', format: 'txt', contents: 'text2', downloaded: true } } ),
  ], null)
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: [
    { role: 'user', parts: [ { text: 'prompt1\n\ntext1' } ] },
    { role: 'model', parts: [ { text: 'response1' } ] },
  ]})
  expect(_Google.GoogleChat.prototype.sendMessageStream).toHaveBeenCalledWith(['prompt2', 'text2'])
})

test('Google Image Attachments', async () => {
  const google = new Google(store.config)
  await google.stream([
    new Message('system', 'instruction'),
    new Message('user', { role: 'user', type: 'text', content: 'prompt1', attachment: { url: '', format: 'png', contents: 'image', downloaded: true } } ),
    new Message('assistant', 'response1'),
    new Message('user', { role: 'user', type: 'text', content: 'prompt2', attachment: { url: '', format: 'png', contents: 'image', downloaded: true } } ),
  ], null)
  expect(_Google.GoogleModel.prototype.startChat).toHaveBeenCalledWith({ history: [
    { role: 'user', parts: [ { text: 'prompt1' }, { inlineData: { data: 'image', mimeType: 'image/png' }} ] },
    { role: 'model', parts: [ { text: 'response1' } ] },
  ]})
  expect(_Google.GoogleChat.prototype.sendMessageStream).toHaveBeenCalledWith(['prompt2', { inlineData: { data: 'image', mimeType: 'image/png' }}])
})
