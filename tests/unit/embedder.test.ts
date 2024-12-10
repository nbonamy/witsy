
import { test, expect, vi, beforeEach } from 'vitest'
import { app } from 'electron'
import Embedder  from '../../src/rag/embedder'
import defaultSettings from '../../defaults/settings.json'
import { Ollama } from 'ollama/dist/browser.mjs'
import OpenAI from 'openai'

vi.mock('openai', async () => {
  const OpenAI = vi.fn()
  OpenAI.prototype.embeddings = {
    create: vi.fn((params: any) => {
      return { data: params.input.map((i: string) => {
        return { embedding: i.split('').reverse().map((c) => c.charCodeAt(0)) }
      })}
    })
  }
  return { default : OpenAI }
})

vi.mock('ollama/browser', async() => {
  const Ollama = vi.fn()
  Ollama.prototype.show = vi.fn(() => {
    return { model_info: { embedding_length: 384 } }
  })
  Ollama.prototype.embed = vi.fn((opts) => {
    return { embeddings: opts.input.map((i: string) => i.split('').reverse().map((c) => c.charCodeAt(0))) }
  })
  return { Ollama: Ollama }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Model ready', async () => {
  expect(Embedder.isModelReady(app, 'openai', 'text-embedding-ada-002')).toBeTruthy()
  expect(Embedder.isModelReady(app, 'ollama', 'all-minilm')).toBeTruthy()
})

test('Model dimensions', async () => {
  expect(await Embedder.dimensions(defaultSettings, 'openai', 'text-embedding-ada-002')).toBe(1536)
  expect(await Embedder.dimensions(defaultSettings, 'openai', 'text-embedding-3-small')).toBe(1536)
  expect(await Embedder.dimensions(defaultSettings, 'openai', 'text-embedding-3-large')).toBe(3072)
  expect(await Embedder.dimensions(defaultSettings, 'ollama', 'all-minilm')).toBe(384)
})

test('Create OpenAI', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'openai', 'text-embedding-ada-002')
  expect(embedder).toBeTruthy()
  expect(embedder.openai).toBeTruthy()
  expect(embedder.ollama).toBeFalsy()
})

test('Embed OpenAI', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'openai', 'text-embedding-ada-002')
  const embeddings = await embedder.embed(['hello'])
  expect(OpenAI.prototype.embeddings.create).toHaveBeenCalled()
  expect(Ollama.prototype.embed).not.toHaveBeenCalled()
  expect(embeddings).toStrictEqual([[111, 108, 108, 101, 104]])
})

test('Create Ollama', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'ollama', 'all-minilm')
  expect(embedder).toBeTruthy()
  expect(embedder.openai).toBeFalsy()
  expect(embedder.ollama).toBeTruthy()
})

test('Embed Ollama', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'ollama', 'all-minilm')
  const embeddings = await embedder.embed(['hello'])
  expect(Ollama.prototype.embed).toHaveBeenCalled()
  expect(OpenAI.prototype.embeddings.create).not.toHaveBeenCalled()
  expect(embeddings).toStrictEqual([[111, 108, 108, 101, 104]])
})

