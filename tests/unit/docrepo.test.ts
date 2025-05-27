
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import DocumentRepository from '../../src/rag/docrepo'
import DocumentSourceImpl from '../../src/rag/docsource'
import DocumentBaseImpl from '../../src/rag/docbase'
import { DocumentMetadata } from '../../src/types/rag'
import embeddings from '../fixtures/embedder.json'
import defaultSettings from '../../defaults/settings.json'
import { LocalIndex } from 'vectra'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

let ragConfig

vi.mock('electron', async() => {
  return {
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
    },
    app: {
      getPath: vi.fn(() => os.tmpdir()),
    },
  }
})

vi.mock('../../src/main/config', async() => {
  return {
    loadSettings: vi.fn(() => {
      return {
        rag: ragConfig
      }
    })
  }
})

vi.mock('../../src/rag/embedder', async() => {
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
  fs.rmSync(path.join(os.tmpdir(), 'docrepo.json'), { force: true })
  fs.rmSync(path.join(os.tmpdir(), 'docrepo'), { recursive: true, force: true })
}

const createTempDir = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrepotest'))
  fs.copyFileSync(path.join(os.tmpdir(), 'docrepo.json'), path.join(tempDir, 'docrepo.json'))
  fs.copyFileSync(path.join(os.tmpdir(), 'docrepo.json'), path.join(tempDir, 'docrepo2.json'))
  fs.copyFileSync(path.join(os.tmpdir(), 'docrepo.json'), path.join(tempDir, 'docrepo.png'))
  fs.copyFileSync('./tests/fixtures/empty.pdf', path.join(tempDir, 'empty.pdf'))
  return tempDir
}

beforeEach(() => {
  cleanup()
  ragConfig = JSON.parse(JSON.stringify(defaultSettings.rag))
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
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
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
  const metadata: DocumentMetadata = items[0].metadata.metadata as unknown as DocumentMetadata
  expect(metadata.type).toBe('file')
  expect(metadata.title).toBe('docrepo.json')
  expect(metadata.url).toBe(`file://${path.join(os.tmpdir(), 'docrepo.json')}`)
  
})

test('Doc base invalid documents', async () => {
  const docbase = new DocumentBaseImpl(app, '1', 'name', 'openai', 'text-embedding-ada-002')
  await docbase.create()
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.jpg'))).rejects.toThrowError(/^Unsupported document type$/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.png'))).rejects.toThrowError(/^Unsupported document type$/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.docx'))).rejects.toThrowError(/^Unable to load document$/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'empty.pdf'))).rejects.toThrowError(/^Unable to load document$/)
})

test('Docrepo invalid documents', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'test.jpg'))
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'test.png'))
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'test.mov'))
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'test.docx'))
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'empty.pdf'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)
  
})

test('Docrepo large document', async () => {
  
  ragConfig.maxDocumentSizeMB = 0.0001
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)
  
})

test('Docrepo update document', async () => {
  
  ragConfig.chunkSize = 500
  ragConfig.chunkOverlap = 50
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid1 = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  const docid2 = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  expect(docid1).toBe(docid2)

  // check docrepo
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const fileSize = fs.statSync(path.join(os.tmpdir(), 'docrepo.json')).size
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(Math.ceil(fileSize * 1.1 / 500))

})

test('Docrepo delete document', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocument(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'))
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  await docrepo.removeDocument(docbase, docid)

  // check docrepo
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
  const docid = await docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })

  // check docrepo
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('folder')
  expect(list[0].documents[0].origin).toBe(tempdir)
  expect(list[0].documents[0].url).toBe('file://' + tempdir)
  expect(list[0].documents[0].items).toHaveLength(2)
  expect(list[0].documents[0].items[0].filename).toBe('docrepo.json')
  expect(list[0].documents[0].items[1].filename).toBe('docrepo2.json')

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(2)

  // check items
  const metadata0: DocumentMetadata = items[0].metadata.metadata as unknown as DocumentMetadata
  const metadata1: DocumentMetadata = items[1].metadata.metadata as unknown as DocumentMetadata
  expect(metadata0.type).toBe('file')
  expect(metadata0.title).toBe('docrepo.json')
  expect(metadata0.url).toBe(`file://${path.join(tempdir, 'docrepo.json')}`)
  expect(metadata1.type).toBe('file')
  expect(metadata1.title).toBe('docrepo2.json')
  expect(metadata1.url).toBe(`file://${path.join(tempdir, 'docrepo2.json')}`)

})

test('Docrepo update folder', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid1 = await docrepo.addDocument(docbase, 'folder', tempdir)
  const docid2 = await docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  expect(docid1).toBe(docid2)

  // check docrepo
  const list = docrepo.list()
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(2)

})

test('Docrepo delete folder', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = await docrepo.addDocument(docbase, 'folder', tempdir)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  await docrepo.removeDocument(docbase, docid)

  // check docrepo
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

test('Docrepo query score', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const docid1 = await docrepo.addDocument(docbase, 'text', 'Angela was born in 1980')
  const docid2 = await docrepo.addDocument(docbase, 'text', 'squash is more fun than tennis')
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // with zero relevance cut off to check sorting
  ragConfig.relevanceCutOff = 0.0
  const query1 = await docrepo.query(docbase, 'tell me about squash')
  expect(query1).toBeDefined()
  expect(query1.length).toBe(2)
  expect(query1[0].metadata.uuid).toBe(docid2)
  expect(query1[1].metadata.uuid).toBe(docid1)
  expect(query1[0].score).toBeGreaterThan(query1[1].score)

  // with relevance cut off to check filtering
  ragConfig.relevanceCutOff = query1[1].score * 1.1
  const query2 = await docrepo.query(docbase, 'tell me about squash')
  expect(query2.length).toBe(1)
  expect(query2[0].metadata.uuid).toBe(docid2)
})

test('Docrepo load', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.create('name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = await docrepo.addDocument(docbase, 'folder', tempdir)
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
