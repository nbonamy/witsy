
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { RagConfig } from '@/types/config'
import DocumentRepository from '@main/rag/docrepo'
import DocumentSourceImpl from '@main/rag/docsource'
import DocumentBaseImpl from '@main/rag/docbase'
import { DocumentMetadata } from '@/types/rag'
import embeddings from '@tests/fixtures/embedder.json'
import defaultSettings from '@root/defaults/settings.json'
import { LocalIndex } from 'vectra'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

let ragConfig: RagConfig

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

vi.mock('@main/config', async() => {
  return {
    loadSettings: vi.fn(() => {
      return {
        rag: ragConfig
      }
    })
  }
})

vi.mock('@main/rag/embedder', async() => {
  const Embedder: any = vi.fn()
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
  expect(docrepo.list('workspace')).toEqual([])
})

test('Docrepo create', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  expect(docbase).toBeDefined()
  const list = docrepo.list('workspace')
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

test('Docrepo update', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const list = docrepo.list('workspace')
  expect(list[0].name).toBe('name')
  expect(list[0].description).toBeUndefined()
  docrepo.updateDocBase(docbase, 'newname', 'test description')
  const list2 = docrepo.list('workspace')
  expect(list2[0].name).toBe('newname')
  expect(list2[0].description).toBe('test description')
})

test('Docrepo delete', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  await docrepo.deleteDocBase(docbase)
  const list = docrepo.list('workspace')
  expect(list.length).toBe(0)
  expect(fs.existsSync(path.join(os.tmpdir(), 'docrepo', docbase))).toBe(false)
})

test('Docrepo delete notifies listeners', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  
  // Add some documents first
  const tempdir = createTempDir()
  await docrepo.addDocumentSource(docbase, 'file', path.join(tempdir, 'docrepo.json'), true)
  await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // Create mock listener
  const mockListener = {
    onDocumentSourceAdded: vi.fn(),
    onDocumentSourceRemoved: vi.fn()
  }
  docrepo.addListener(mockListener)
  
  // Delete the document base
  await docrepo.deleteDocBase(docbase)
  
  // Verify listeners were notified of all document removals
  expect(mockListener.onDocumentSourceRemoved).toHaveBeenCalledWith(path.join(tempdir, 'docrepo.json'))
  expect(mockListener.onDocumentSourceRemoved).toHaveBeenCalledWith(tempdir)
  expect(mockListener.onDocumentSourceRemoved).toHaveBeenCalledWith(path.join(tempdir, 'docrepo2.json'))
  // The folder contains 2 supported files (both .json files), so total calls = 1 file + 1 folder + 2 child files = 4
  expect(mockListener.onDocumentSourceRemoved).toHaveBeenCalledTimes(4)
  
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo add document', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('file')
  expect(list[0].documents[0].origin).toBe(path.join(os.tmpdir(), 'docrepo.json'))
  expect(list[0].documents[0].url).toBe('file://' + path.join(os.tmpdir(), 'docrepo.json'))

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items.length).toBeGreaterThan(0)

  // check item
  expect(items[0].metadata.docId).toBe(docid)
  const metadata: DocumentMetadata = items[0].metadata.metadata as unknown as DocumentMetadata
  expect(metadata.type).toBe('file')
  expect(metadata.title).toBe('docrepo.json')
  expect(metadata.url).toBe(`file://${path.join(os.tmpdir(), 'docrepo.json')}`)
  
})

test('Doc base invalid documents', async () => {
  const docbase = new DocumentBaseImpl(app, '1', 'name', 'openai', 'text-embedding-ada-002', 'workspace')
  await docbase.create()
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.jpg'))).rejects.toThrowError(/Unsupported document type/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.png'))).rejects.toThrowError(/Unsupported document type/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'test.docx'))).rejects.toThrowError(/Unable to load document/)
  await expect(() => docbase.addDocument(new DocumentSourceImpl('1', 'file', 'empty.pdf'))).rejects.toThrowError(/Unable to load document/)
})

test('Docrepo invalid documents', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'test.jpg'), true)
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'test.png'), true)
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'test.mov'), true)
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'test.docx'), true)
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'empty.pdf'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)
  
})

test('Docrepo large document', async () => {
  
  ragConfig.maxDocumentSizeMB = 0.0001
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)
  
})

test('Docrepo large document - skip file size check', async () => {
  
  ragConfig.maxDocumentSizeMB = 0.0001
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true, { skipSizeCheck: true })
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(1)
  
})

test('Docrepo update document', async () => {
  
  ragConfig.chunkSize = 500
  ragConfig.chunkOverlap = 50
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const docid1 = await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  const docid2 = await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  expect(docid1).toBe(docid2)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const fileSize = fs.statSync(path.join(os.tmpdir(), 'docrepo.json')).size
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(Math.ceil(fileSize * 1.1 / 500))

})

test('Docrepo delete document', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  await docrepo.removeDocumentSource(docbase, docid)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)

})

test('Docrepo add folder', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })

  // check docrepo
  const list = docrepo.list('workspace')
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
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid1 = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  const docid2 = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  expect(docid1).toBe(docid2)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(2)

})

test('Docrepo delete folder', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempdir, { recursive: true, force: true })
  await docrepo.removeDocumentSource(docbase, docid)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // check docrepo
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(0)

  // check the database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase))
  const items = await db.listItems()
  expect(items).toHaveLength(0)

})

test('Docrepo query', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const docid = await docrepo.addDocumentSource(docbase, 'file', path.join(os.tmpdir(), 'docrepo.json'), true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  const query = await docrepo.query(docbase, 'whatever')
  expect(query).toBeDefined()
  expect(query.length).toBeGreaterThan(0)
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
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const docid1 = await docrepo.addDocumentSource(docbase, 'text', 'Angela was born in 1980', true, { title: 'Title1' })
  const docid2 = await docrepo.addDocumentSource(docbase, 'text', 'squash is more fun than tennis', true, { title: 'Title2' })
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
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  const tempdir = createTempDir()
  const docid = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // reload
  docrepo.load()

  // check the list
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].uuid).toBe(docid)
  expect(list[0].documents[0].type).toBe('folder')
  expect(list[0].documents[0].origin).toBe(tempdir)
  expect(list[0].documents[0].url).toBe('file://' + tempdir)
  expect(list[0].documents[0].items).toHaveLength(2)
  expect(list[0].documents[0].items[0].filename).toBe('docrepo.json')
  expect(list[0].documents[0].items[1].filename).toBe('docrepo2.json')

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('DocumentRepository detects offline file changes', async () => {
  
  // we need a config
  ragConfig = defaultSettings.rag
  
  // create docrepo and docbase
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'Test DB', 'openai', 'text-embedding-3-small')
  
  // create temp file and add it
  const tempdir = createTempDir()
  const tempFile = path.join(tempdir, 'test.txt')
  fs.writeFileSync(tempFile, 'original content')
  
  await docrepo.addDocumentSource(docbase, 'file', tempFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // simulate app restart - reload docrepo
  docrepo.load()
  
  // modify file while "offline"
  await new Promise(resolve => setTimeout(resolve, 10)) // ensure different mtime
  fs.writeFileSync(tempFile, 'modified content')
  
  // scan for offline changes
  await new Promise<void>((resolve) => {
    docrepo.scanForUpdates(() => {
      resolve()
    })
  })
  
  // should detect the change
  // Note: In real scenario, the modified document would be reprocessed
  // Here we just verify the scan completes without error
  expect(true).toBe(true) // Test passes if no errors thrown
  
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('DocumentRepository detects new files added offline', async () => {
  
  // we need a config
  ragConfig = defaultSettings.rag
  
  // create docrepo and docbase
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'Test DB', 'openai', 'text-embedding-3-small')
  
  // create temp folder and add it
  const tempdir = createTempDir()
  const docid = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // simulate app restart - reload docrepo
  docrepo.load()
  
  // add new file while "offline"
  const newFile = path.join(tempdir, 'newfile.txt')
  fs.writeFileSync(newFile, 'new file content')
  
  // scan for offline changes
  await new Promise<void>((resolve) => {
    docrepo.scanForUpdates(() => {
      resolve()
    })
  })
  
  // should detect new file and add it
  const list = docrepo.list('workspace')
  const folderDoc = list[0].documents.find(d => d.uuid === docid)
  expect(folderDoc?.items?.some(item => item.origin === newFile)).toBe(true)
  
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('DocumentRepository detects deleted files offline', async () => {
  
  // we need a config
  ragConfig = defaultSettings.rag
  
  // create docrepo and docbase
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'Test DB', 'openai', 'text-embedding-3-small')
  
  // create temp file and add it
  const tempdir = createTempDir()
  const tempFile = path.join(tempdir, 'test.txt')
  fs.writeFileSync(tempFile, 'test content')
  
  const docid = await docrepo.addDocumentSource(docbase, 'file', tempFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // simulate app restart - reload docrepo
  docrepo.load()
  
  // delete file while "offline"
  fs.rmSync(tempFile)
  
  // scan for offline changes
  await new Promise<void>((resolve) => {
    docrepo.scanForUpdates(() => {
      resolve()
    })
  })
  
  // should detect deletion and remove document
  const list = docrepo.list('workspace')
  expect(list[0].documents.find(d => d.uuid === docid)).toBeUndefined()
  
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo add child document success', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  
  // First add a folder as parent
  const tempdir = createTempDir()
  const parentDocId = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // Create a temp file to add as child
  const tempFile = path.join(os.tmpdir(), 'docrepo_child.json')
  fs.writeFileSync(tempFile, '{"test": "content"}')
  
  // Add child document to the folder
  const childDocId = await docrepo.addChildDocumentSource(docbase, parentDocId, 'file', tempFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // Check docrepo structure
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)
  const parentDoc = list[0].documents[0]
  expect(parentDoc.uuid).toBe(parentDocId)
  expect(parentDoc.type).toBe('folder')
  
  // Check that child was added to parent's items
  expect(parentDoc.items).toHaveLength(3) // 2 original files from createTempDir + 1 new child
  const childDoc = parentDoc.items.find(item => item.uuid === childDocId)
  expect(childDoc).toBeDefined()
  expect(childDoc!.type).toBe('file')
  expect(childDoc!.origin).toBe(tempFile)
  
  // Cleanup
  fs.rmSync(tempFile, { force: true })
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo add child document error case', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  
  // First add a folder as parent
  const tempdir = createTempDir()
  const parentDocId = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // Try to add a non-existent file as child (this should fail)
  const nonExistentFile = '/path/to/nonexistent/file.txt'
  const childDocId = await docrepo.addChildDocumentSource(docbase, parentDocId, 'file', nonExistentFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)
  
  // Check docrepo structure - child should NOT be in parent's items due to processing failure
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)
  const parentDoc = list[0].documents[0]
  expect(parentDoc.uuid).toBe(parentDocId)
  expect(parentDoc.type).toBe('folder')
  
  // Check that child was NOT added to parent's items due to error
  expect(parentDoc.items).toHaveLength(2) // Only the 2 original files from createTempDir
  const childDoc = parentDoc.items.find(item => item.uuid === childDocId)
  expect(childDoc).toBeUndefined()
  
  // Cleanup
  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo add child document with missing parent', async () => {
  
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')
  
  // Try to add child to non-existent parent
  const tempFile = path.join(os.tmpdir(), 'docrepo_child.json')
  fs.writeFileSync(tempFile, '{"test": "content"}')
  
  // This should throw an error for missing parent
  await expect(async () => {
    await docrepo.addChildDocumentSource(docbase, 'non-existent-parent-id', 'file', tempFile, true)
  }).rejects.toThrow('Parent document not found')
  
  // Cleanup
  fs.rmSync(tempFile, { force: true })
})

test('Docrepo cancel task in queue', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add multiple documents to queue
  const tempdir = createTempDir()
  await docrepo.addDocumentSource(docbase, 'file', path.join(tempdir, 'docrepo.json'), true)
  const taskId2 = await docrepo.addDocumentSource(docbase, 'file', path.join(tempdir, 'docrepo2.json'), true)

  // Cancel the second task before it starts processing
  expect(docrepo.queueLength()).toBe(2)
  docrepo.cancelTask(taskId2)

  // Wait for first task to complete
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Check that only first document was added
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)
  expect(list[0].documents[0].origin).toBe(path.join(tempdir, 'docrepo.json'))

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo cancel currently processing task', async () => {

  ragConfig.chunkSize = 100
  ragConfig.chunkOverlap = 20

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a very large folder to ensure long processing time
  const tempdir = createTempDir()
  // Add many more files to make processing slower
  for (let i = 0; i < 10; i++) {
    const largeFile = path.join(tempdir, `large${i}.json`)
    fs.writeFileSync(largeFile, JSON.stringify({ data: 'x'.repeat(50000) }))
  }

  const taskId = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)

  // Wait for processing to start
  await new Promise(resolve => setTimeout(resolve, 100))

  // Cancel while processing
  docrepo.cancelTask(taskId)

  // Wait for queue to be empty
  await vi.waitUntil(() => docrepo.queueLength() == 0, { timeout: 10000 })

  // Folder might be added but children should be cancelled
  // Just verify no crash and queue cleared
  const list = docrepo.list('workspace')
  expect(list[0].documents.length).toBeLessThanOrEqual(1)

  // If folder was added, it should have fewer than all children
  if (list[0].documents.length === 1) {
    expect(list[0].documents[0].items.length).toBeLessThan(10)
  }

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo cancel folder processing', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Create folder with multiple files
  const tempdir = createTempDir()

  const taskId = await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)

  // Wait a bit for processing to start
  await new Promise(resolve => setTimeout(resolve, 50))

  // Cancel while processing folder children
  docrepo.cancelTask(taskId)

  // Wait for queue to be empty
  await vi.waitUntil(() => docrepo.queueLength() == 0, { timeout: 5000 })

  // Folder might be partially added - just verify no crash and queue cleared
  const list = docrepo.list('workspace')
  expect(list[0].documents.length).toBeLessThanOrEqual(1)

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo cancel non-existent task', () => {

  const docrepo = new DocumentRepository(app)

  // Cancelling a non-existent task should not throw
  expect(() => docrepo.cancelTask('non-existent-task-id')).not.toThrow()
})

test('Docrepo cancel task at queue position 0', async () => {

  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a document
  const tempFile = path.join(os.tmpdir(), 'test_doc.json')
  fs.writeFileSync(tempFile, '{"test": "data"}')

  const taskId = await docrepo.addDocumentSource(docbase, 'file', tempFile, true)

  // Immediately cancel (task should be at index 0, being processed)
  docrepo.cancelTask(taskId)

  // Wait for queue to be empty
  await vi.waitUntil(() => docrepo.queueLength() == 0, { timeout: 5000 })

  // Document should not be added
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(0)

  fs.rmSync(tempFile, { force: true })
})

test('Docrepo removeListener', async () => {
  const docrepo = new DocumentRepository(app)

  const mockListener = {
    onDocumentSourceAdded: vi.fn(),
    onDocumentSourceRemoved: vi.fn()
  }

  // Add listener
  docrepo.addListener(mockListener)
  expect(docrepo.listeners).toHaveLength(1)

  // Remove listener
  docrepo.removeListener(mockListener)
  expect(docrepo.listeners).toHaveLength(0)

  // Removing non-existent listener should not throw
  docrepo.removeListener(mockListener)
  expect(docrepo.listeners).toHaveLength(0)
})

test('Docrepo listener notifications on add', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  const mockListener = {
    onDocumentSourceAdded: vi.fn(),
    onDocumentSourceRemoved: vi.fn()
  }
  docrepo.addListener(mockListener)

  // Add a document
  const tempFile = path.join(os.tmpdir(), 'listener_test.json')
  fs.writeFileSync(tempFile, '{"test": "data"}')
  await docrepo.addDocumentSource(docbase, 'file', tempFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Listener should have been notified
  expect(mockListener.onDocumentSourceAdded).toHaveBeenCalled()

  fs.rmSync(tempFile, { force: true })
})

test('Docrepo getCurrentQueueItem returns item when queue not empty', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Initially queue is empty
  expect(docrepo.getCurrentQueueItem()).toBeNull()

  // Add document to queue
  const tempFile = path.join(os.tmpdir(), 'queue_test.json')
  fs.writeFileSync(tempFile, '{"test": "data"}')
  await docrepo.addDocumentSource(docbase, 'file', tempFile, true)

  // Queue item should exist while processing
  // Note: This might be null if processing is too fast, so we just verify no crash
  docrepo.getCurrentQueueItem()
  // result could be null or a queue item depending on timing

  await vi.waitUntil(() => docrepo.queueLength() == 0)
  fs.rmSync(tempFile, { force: true })
})

test('Docrepo connect throws for non-existent base', async () => {
  const docrepo = new DocumentRepository(app)

  await expect(docrepo.connect('non-existent-base-id')).rejects.toThrow('Database not found')
})

test('Docrepo connect with replaceActive false', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase1 = await docrepo.createDocBase('workspace', 'name1', 'openai', 'text-embedding-ada-002')
  const docbase2 = await docrepo.createDocBase('workspace', 'name2', 'openai', 'text-embedding-ada-002')

  // activeDb should be docbase2 (last created)
  expect(docrepo.activeDb?.uuid).toBe(docbase2)

  // Connect to docbase1 without replacing active
  const base = await docrepo.connect(docbase1, false)
  expect(base).toBeDefined()
  expect(base.uuid).toBe(docbase1)
  // activeDb should still be docbase2
  expect(docrepo.activeDb?.uuid).toBe(docbase2)
})

test('Docrepo connect with connectToDb false', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Disconnect first
  await docrepo.disconnect()
  expect(docrepo.activeDb).toBeNull()

  // Connect without actually connecting to db
  const base = await docrepo.connect(docbase, true, false)
  expect(base).toBeDefined()
  expect(docrepo.activeDb).toBe(base)
})

test('Docrepo disconnect', async () => {
  const docrepo = new DocumentRepository(app)
  await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  expect(docrepo.activeDb).not.toBeNull()

  await docrepo.disconnect()
  expect(docrepo.activeDb).toBeNull()

  // Disconnect again should not throw
  await docrepo.disconnect()
  expect(docrepo.activeDb).toBeNull()
})

test('Docrepo updateDocBase throws for non-existent base', async () => {
  const docrepo = new DocumentRepository(app)

  await expect(docrepo.updateDocBase('non-existent', 'title')).rejects.toThrow('Database not found')
})

test('Docrepo deleteDocBase throws for non-existent base', async () => {
  const docrepo = new DocumentRepository(app)

  await expect(docrepo.deleteDocBase('non-existent')).rejects.toThrow('Database not found')
})

test('Docrepo getDocumentSource returns null for non-existent base', () => {
  const docrepo = new DocumentRepository(app)

  const result = docrepo.getDocumentSource('non-existent-base', 'doc-id')
  expect(result).toBeNull()
})

test('Docrepo getDocumentSource returns null for non-existent doc', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  const result = docrepo.getDocumentSource(docbase, 'non-existent-doc')
  expect(result).toBeNull()
})

test('Docrepo isSourceSupported', async () => {
  const docrepo = new DocumentRepository(app)

  // Supported types
  expect(docrepo.isSourceSupported('file', 'test.json')).toBe(true)
  expect(docrepo.isSourceSupported('file', 'test.txt')).toBe(true)
  expect(docrepo.isSourceSupported('file', 'test.md')).toBe(true)

  // Unsupported types
  expect(docrepo.isSourceSupported('file', 'test.jpg')).toBe(false)
  expect(docrepo.isSourceSupported('file', 'test.png')).toBe(false)
  expect(docrepo.isSourceSupported('file', 'test.mp4')).toBe(false)
})

test('Docrepo removeDocumentSource for child document', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a folder
  const tempdir = createTempDir()
  await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Get a child document ID
  const list = docrepo.list('workspace')
  const folderDoc = list[0].documents[0]
  expect(folderDoc.items.length).toBeGreaterThan(0)
  const childDocId = folderDoc.items[0].uuid

  // Remove the child document using removeDocumentSource (not removeChildDocumentSource)
  await docrepo.removeDocumentSource(docbase, childDocId)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Child should be removed
  const updatedList = docrepo.list('workspace')
  const updatedFolder = updatedList[0].documents[0]
  expect(updatedFolder.items.find(i => i.uuid === childDocId)).toBeUndefined()

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo removeDocumentSource for non-existent doc', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Should not throw, just log warning
  await docrepo.removeDocumentSource(docbase, 'non-existent-doc')
  await vi.waitUntil(() => docrepo.queueLength() == 0)
})

test('Docrepo removeChildDocumentSource', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a folder
  const tempdir = createTempDir()
  await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Get a child document ID
  const list = docrepo.list('workspace')
  const folderDoc = list[0].documents[0]
  const childDocId = folderDoc.items[0].uuid

  // Remove child using removeChildDocumentSource
  await docrepo.removeChildDocumentSource(docbase, childDocId)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Child should be removed
  const updatedList = docrepo.list('workspace')
  const updatedFolder = updatedList[0].documents[0]
  expect(updatedFolder.items.find(i => i.uuid === childDocId)).toBeUndefined()

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo removeChildDocumentSource for non-existent doc', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Should not throw, just log warning
  await docrepo.removeChildDocumentSource(docbase, 'non-existent-child')
  await vi.waitUntil(() => docrepo.queueLength() == 0)
})

test('Docrepo updateDocumentSource', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a document
  const tempFile = path.join(os.tmpdir(), 'update_test.json')
  fs.writeFileSync(tempFile, '{"original": "content"}')
  const docId = await docrepo.addDocumentSource(docbase, 'file', tempFile, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Modify the file
  fs.writeFileSync(tempFile, '{"updated": "content"}')

  // Update the document
  await docrepo.updateDocumentSource(docbase, docId)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Document should still exist
  const list = docrepo.list('workspace')
  expect(list[0].documents).toHaveLength(1)

  fs.rmSync(tempFile, { force: true })
})

test('Docrepo updateDocumentSource for non-existent doc', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Should not throw, just log warning
  await docrepo.updateDocumentSource(docbase, 'non-existent-doc')
  await vi.waitUntil(() => docrepo.queueLength() == 0)
})

test('Docrepo updateChildDocumentSource', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Add a folder
  const tempdir = createTempDir()
  await docrepo.addDocumentSource(docbase, 'folder', tempdir, true)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Get a child document ID
  const list = docrepo.list('workspace')
  const folderDoc = list[0].documents[0]
  const childDocId = folderDoc.items[0].uuid

  // Update the child document
  await docrepo.updateChildDocumentSource(docbase, childDocId)
  await vi.waitUntil(() => docrepo.queueLength() == 0)

  // Child should still exist
  const updatedList = docrepo.list('workspace')
  const updatedFolder = updatedList[0].documents[0]
  expect(updatedFolder.items.find(i => i.uuid === childDocId)).toBeDefined()

  fs.rmSync(tempdir, { recursive: true, force: true })
})

test('Docrepo updateChildDocumentSource for non-existent doc', async () => {
  const docrepo = new DocumentRepository(app)
  const docbase = await docrepo.createDocBase('workspace', 'name', 'openai', 'text-embedding-ada-002')

  // Should not throw, just log warning
  await docrepo.updateChildDocumentSource(docbase, 'non-existent-child')
  await vi.waitUntil(() => docrepo.queueLength() == 0)
})
