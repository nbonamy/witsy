
import { test, expect, vi, beforeEach } from 'vitest'
import { app } from 'electron'
import Embedder  from '@main/rag/embedder'
import defaultSettings from '@root/defaults/settings.json'
import { Ollama } from 'ollama'
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

vi.mock('ollama', async() => {
  const Ollama = vi.fn()
  Ollama.prototype.show = vi.fn(() => {
    return { model_info: { embedding_length: 384 } }
  })
  Ollama.prototype.embed = vi.fn((opts) => {
    return { embeddings: opts.input.map((i: string) => i.split('').reverse().map((c) => c.charCodeAt(0))) }
  })
  return { Ollama: Ollama }
})

vi.mock('@google/genai', async () => {
  const GoogleGenAI = vi.fn()
  GoogleGenAI.prototype.models = {
    embedContent: vi.fn((opts) => {
      return {
        embeddings: [{
          values: opts.contents.split('').reverse().map((c) => c.charCodeAt(0))
        }]
      }
    })
  }
  return { GoogleGenAI }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Model ready', async () => {
  expect(Embedder.isModelReady(app, 'openai', 'text-embedding-ada-002')).toBeTruthy()
  expect(Embedder.isModelReady(app, 'ollama', 'all-minilm')).toBeTruthy()
  expect(Embedder.isModelReady(app, 'google', 'text-embedding-004')).toBeTruthy()
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

test('Create LM Studio', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'lmstudio', 'jina-embeddings-v5-text-small-retrieval')
  expect(embedder).toBeTruthy()
  expect(embedder.openai).toBeTruthy()
  expect(embedder.ollama).toBeFalsy()
  expect(embedder.google).toBeFalsy()
})

test('Embed LM Studio', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'lmstudio', 'jina-embeddings-v5-text-small-retrieval')
  const embeddings = await embedder.embed(['hello'])
  expect(OpenAI.prototype.embeddings.create).toHaveBeenCalled()
  expect(Ollama.prototype.embed).not.toHaveBeenCalled()
  expect(embeddings).toStrictEqual([[111, 108, 108, 101, 104]])
})

test('Create Google', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'google', 'text-embedding-004')
  expect(embedder).toBeTruthy()
  expect(embedder.openai).toBeFalsy()
  expect(embedder.google).toBeTruthy()
})

test('Embed Google', async () => {
  const embedder = await Embedder.init(app, defaultSettings, 'google', 'text-embedding-004')
  const embeddings = await embedder.embed(['hello'])
  expect(embedder.google.models.embedContent).toHaveBeenCalled()
  expect(embeddings).toStrictEqual([[111, 108, 108, 101, 104]])
})
