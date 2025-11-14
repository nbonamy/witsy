
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import MemoryManager from '../../../src/main/memory'
import embeddings from '../../fixtures/embedder.json'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: vi.fn(() => os.tmpdir())
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((data) => `encrypted-${data}`),
      decryptString: vi.fn((data) => data.toString('latin1'))
    },
  }
})

vi.mock('../../../src/main/rag/embedder', async() => {
  const Embedder = vi.fn()
  Embedder.prototype.embed = vi.fn((texts: string[]) => {
    if (texts[0].includes('squash') && texts[0].includes('tennis')) return Array(texts.length).fill(embeddings['squashtennis'])
    else if (texts[0].includes('squash')) return Array(texts.length).fill(embeddings['squash'])
    else return Array(texts.length).fill(embeddings['other'])
  })
  Embedder['init'] = vi.fn(() => new Embedder())
  return { default: Embedder }
})

const cleanup = () => {
  fs.rmSync(path.join(os.tmpdir(), 'memory'), { recursive: true, force: true })
}

beforeEach(() => {
  cleanup()
})

afterEach(() => {
  cleanup()
})

test('MemoryManager initialization', async () => {
  const memory = new MemoryManager(app)
  expect(memory).toBeDefined()
  expect(await memory.list()).toEqual([])
  expect(await memory.isNotEmpty()).toBe(false)
})

test('MemoryManager store', async () => {
  const memory = new MemoryManager(app)
  await memory.store(['I play squash and tennis', 'I play squash'])
  expect(await memory.isNotEmpty()).toBe(true)
  expect((await memory.list()).sort((a,b) => a.content.localeCompare(b.content))).toEqual([
    { uuid: expect.any(String), content: 'I play squash' },
    { uuid: expect.any(String), content: 'I play squash and tennis' },
  ])
})

test('MemoryManager retrieve', async () => {
  const memory = new MemoryManager(app)
  await memory.store(['I play squash and tennis'])
  expect(await memory.query('squash')).toEqual(['I play squash and tennis'])
  expect(await memory.query('tennis')).toEqual([])
})

test('MemoryManager delete', async () => {
  const memory = new MemoryManager(app)
  await memory.store(['I play squash and tennis'])
  expect(await memory.delete((await memory.list())[0].uuid)).toBe(true)
  expect(await memory.list()).toEqual([])
})

test('MemoryManager delete non-existent', async () => {
  const memory = new MemoryManager(app)
  await memory.store(['I play squash and tennis'])
  expect(await memory.delete('non-existent')).toBe(false)
  expect(await memory.list()).toEqual([
    { uuid: expect.any(String), content: 'I play squash and tennis' }
  ])
})

test('MemoryManager destroy', async () => {
  const memory = new MemoryManager(app)
  await memory.store(['I play squash and tennis'])
  expect(fs.existsSync(path.join(os.tmpdir(), 'memory'))).toBe(true)
  await memory.reset()
  expect(fs.existsSync(path.join(os.tmpdir(), 'memory'))).toBe(false)
})
