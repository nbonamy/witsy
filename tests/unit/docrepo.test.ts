
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import DocumentRepository from '../../src/rag/docrepo'
import { LocalIndex } from 'vectra'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('electron', async() => {
  return {
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
    },
    app: {
      getPath: vi.fn(() => os.tmpdir())
    },
  }
})

vi.mock('../../src/rag/embedder', async() => {
  const Embedder = vi.fn()
  Embedder.prototype.dimensions = vi.fn(() => 128)
  Embedder.prototype.embed = vi.fn(() => Array(128).fill(1.0))
  return { default: Embedder }
})

const cleanup = () => {
  fs.rmSync(path.join(os.tmpdir(), 'docrepo.json'), { force: true })
  fs.rmSync(path.join(os.tmpdir(), 'docrepo'), { recursive: true, force: true })
}

beforeEach(() => {
  cleanup()
})

afterEach(() => {
  cleanup()
})

test('Docrepo initialization', () => {
  const docrepo = new DocumentRepository(app)
  expect(docrepo).toBeDefined()
  expect(docrepo.list()).toEqual([])
})

test('Docrepo create', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  expect(docbase).toBeDefined()
  const list = docrepo.list()
  expect(list).toBeDefined()
  expect(list.length).toBe(1)
  expect(list[0].uuid).toBe(docbase)
  expect(list[0].name).toBe('name')
  expect(list[0].embeddingEngine).toBe('openai')
  expect(list[0].embeddingModel).toBe('text-embedding-ada-002')
  expect(list[0].documents).toHaveLength(0)
  expect(fs.existsSync(path.join(os.tmpdir(), 'docrepo', docbase))).toBe(true)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  expect(await db.isIndexCreated()).toBe(true)
  expect(await db.listItems()).toHaveLength(0)

})

test('Docrepo delete', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  await docrepo.delete(docbase)
  const list = docrepo.list()
  expect(list.length).toBe(0)
  expect(fs.existsSync(path.join(os.tmpdir(), 'docrepo', docbase))).toBe(false)
})

test('Docrepo add document', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  expect(docid).toBeDefined()
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('file')
  expect(list[0].documents[0].origin).toBe(path.join(os.tmpdir(), 'docrepo.json'))
  expect(list[0].documents[0].url).toBe('file://' + path.join(os.tmpdir(), 'docrepo.json'))

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(1)
  expect(items[0].metadata.docId).toBe(docid)

})

test('Docrepo delete document', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await docrepo.removeDocument(docbase, docid)
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)

})

test('Docrepo query', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  const query = await docrepo.query(docbase, 'whatever')
  expect(query).toBeDefined()
  expect(query.length).toBe(1)
  expect(query[0].content).toBeDefined()
  expect(query[0].score).toBeDefined()
  expect(query[0].metadata).toBeDefined()
  expect(query[0].metadata.uuid).toBe(docid)
  expect(query[0].metadata.type).toBe('file')
  expect(query[0].metadata.title).toBe('docrepo.json')
  expect(query[0].metadata.url).toBe(`file://${path.join(os.tmpdir(), 'docrepo.json')}`)
})
