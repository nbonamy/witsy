
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import DocumentRepository from '../../src/rag/docrepo'
import embeddings from '../fixtures/embedder.json'
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
  Embedder.dimensions = vi.fn(() => 384)
  Embedder.prototype.embed = vi.fn((text:string) => {
    if (text.includes('squash') && text.includes('tennis')) return embeddings['squashtennis']
    else if (text.includes('squash')) return embeddings['squash']
    else return embeddings['other']
  })
  Embedder.init = vi.fn(() => new Embedder())
  return { default: Embedder }
})

const cleanup = () => {
  fs.rmSync(path.join(os.tmpdir(), 'docrepo.json'), { force: true })
  fs.rmSync(path.join(os.tmpdir(), 'docrepo'), { recursive: true, force: true })
}

const createTempDir = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrepotest'))
  fs.copyFileSync(path.join(os.tmpdir(), 'docrepo.json'), path.join(tempDir, 'docrepo.json'))
  fs.copyFileSync(path.join(os.tmpdir(), 'docrepo.json'), path.join(tempDir, 'docrepo2.json'))
  return tempDir
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

test('Docrepo rename', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const list = docrepo.list()
  expect(list[0].name).toBe('name')
  docrepo.rename(docbase, 'newname')
  const list2 = docrepo.list()
  expect(list2[0].name).toBe('newname')
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
  const docid = docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
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

  // check item
  expect(items[0].metadata.docId).toBe(docid)
  expect(items[0].metadata.metadata.type).toBe('file')
  expect(items[0].metadata.metadata.title).toBe('docrepo.json')
  expect(items[0].metadata.metadata.url).toBe(`file://${path.join(os.tmpdir(), 'docrepo.json')}`)
  
})

test('Docrepo update document', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid1 = docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  const docid2 = docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  expect(docid1).toBe(docid2)
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(1)

})

test('Docrepo delete document', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  await docrepo.removeDocument(docbase, docid)
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)

})

test('Docrepo add folder', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('folder')
  expect(list[0].documents[0].origin).toBe(tempdir)
  expect(list[0].documents[0].url).toBe('file://' + tempdir)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(2)

  // check items
  expect(items[0].metadata.metadata.type).toBe('file')
  expect(items[0].metadata.metadata.title).toBe('docrepo.json')
  expect(items[0].metadata.metadata.url).toBe(`file://${path.join(tempdir, 'docrepo.json')}`)
  expect(items[1].metadata.metadata.type).toBe('file')
  expect(items[1].metadata.metadata.title).toBe('docrepo2.json')
  expect(items[1].metadata.metadata.url).toBe(`file://${path.join(tempdir, 'docrepo2.json')}`)

})

test('Docrepo update folder', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid1 = docrepo.addDocument(docbase, 'folder', tempdir)
  const docid2 = docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  expect(docid1).toBe(docid2)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(2)

})

test('Docrepo delete folder', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
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
  const docid = docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
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

test('Docrepo query sort', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid1 = docrepo.addDocument(docbase, 'text', 'Angela was born in 1980')
  const docid2 = docrepo.addDocument(docbase, 'text', 'squash is more fun than tennis')
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // with zero relevance cut off to check sorting
  docrepo.config.rag = { relevanceCutOff: 0.0 }
  const query1 = await docrepo.query(docbase, 'tell me about squash')
  expect(query1).toBeDefined()
  expect(query1.length).toBe(2)
  expect(query1[0].metadata.uuid).toBe(docid2)
  expect(query1[1].metadata.uuid).toBe(docid1)
  expect(query1[0].score).toBeGreaterThan(query1[1].score)

  // with relevance cut off to check filtering
  docrepo.config.rag = { relevanceCutOff: query1[1].score * 1.1 }
  const query2 = await docrepo.query(docbase, 'tell me about squash')
  expect(query2.length).toBe(1)
})

test('Docrepo load', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })

  // reload
  docrepo.load()

  // check the list
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('folder')
  expect(list[0].documents[0].origin).toBe(tempdir)
  expect(list[0].documents[0].url).toBe('file://' + tempdir)
  expect(list[0].documents[0].items).toHaveLength(2)
  expect(list[0].documents[0].items[0].filename).toBe('docrepo.json')
  expect(list[0].documents[0].items[1].filename).toBe('docrepo2.json')

})
