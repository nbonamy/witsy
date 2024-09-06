
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { app } from 'electron'
import DocumentRepository from '../../src/rag/docrepo'
import * as lancedb from '@lancedb/lancedb'
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
  const db = await lancedb.connect(path.join(os.tmpdir(), 'docrepo', docbase))
  const tables = await db.tableNames()
  expect(tables).toHaveLength(1)
  expect(tables[0]).toBe('vectors')
  const table = await db.openTable('vectors')
  const count = await table.countRows()
  expect(count).toBe(1)
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
  const db = await lancedb.connect(path.join(os.tmpdir(), 'docrepo', docbase))
  const table = await db.openTable('vectors')
  const count = await table.countRows()
  expect(count).toBe(2)

  // check the documents ids
  const docids = []
  for await (const batch of table.query().select(["docid"])) {
    docids.push(String.fromCharCode(...new Uint8Array(batch.data.children[0].values)))
  }
  expect(docids).toStrictEqual(['sample', docid])

})

test('Docrepo delete document', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await docrepo.removeDocument(docbase, docid)
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = await lancedb.connect(path.join(os.tmpdir(), 'docrepo', docbase))
  const table = await db.openTable('vectors')
  const count = await table.countRows()
  expect(count).toBe(1)

  // check the documents ids
  const docids = []
  for await (const batch of table.query().select(["docid"])) {
    docids.push(String.fromCharCode(...new Uint8Array(batch.data.children[0].values)))
  }
  expect(docids).toStrictEqual(['sample'])

})
