
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import DocumentBaseImpl from '../../src/main/rag/docbase'
import DocumentSourceImpl from '../../src/main/rag/docsource'
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

vi.mock('../../src/main/rag/embedder', async() => {
  const Embedder = vi.fn()
  Embedder.prototype.embed = vi.fn((texts: string[]) => {
    if (texts[0].includes('squash') && texts[0].includes('tennis')) return Array(texts.length).fill(embeddings['squashtennis'])
    else if (texts[0].includes('squash')) return Array(texts.length).fill(embeddings['squash'])
    else return Array(texts.length).fill(embeddings['other'])
  })
  Embedder['init'] = vi.fn(() => new Embedder())
  return { default: Embedder }
})

vi.mock('../../src/main/rag/loader', async() => {
  const mockGetSitemapUrls = vi.fn(() => Promise.resolve([]))
  const Loader = vi.fn()
  Loader.prototype.isParseable = vi.fn(() => true)
  Loader.prototype.load = vi.fn(() => 'Test content')
  Loader.prototype.getSitemapUrls = mockGetSitemapUrls
  return { default: Loader, mockGetSitemapUrls }
})

vi.mock('../../src/main/file', async() => {
  return {
    listFilesRecursively: vi.fn(() => [])
  }
})

const cleanup = (uuid: string) => {
  fs.rmSync(path.join(os.tmpdir(), 'docrepo', uuid), { recursive: true, force: true })
}

const createDocBase = async (): Promise<DocumentBaseImpl> => {
  const uuid = crypto.randomUUID()
  const docbase = new DocumentBaseImpl(app, uuid, 'test', 'openai', 'text-embedding-ada-002', 'workspace')
  await docbase.create()
  await docbase.connect()
  return docbase
}

beforeEach(() => {
  ragConfig = JSON.parse(JSON.stringify(defaultSettings.rag))
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup will be done by tests individually
})

test('addSitemap creates child URL documents', async () => {
  const { mockGetSitemapUrls } = await import('../../src/main/rag/loader')
  mockGetSitemapUrls.mockResolvedValue([
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
  ])

  const docbase = await createDocBase()
  const sitemap = new DocumentSourceImpl(crypto.randomUUID(), 'sitemap', 'https://example.com/sitemap.xml')

  await docbase.addSitemap(sitemap, () => {})

  expect(sitemap.items).toHaveLength(3)
  expect(sitemap.items[0].type).toBe('url')
  expect(sitemap.items[0].origin).toBe('https://example.com/page1')
  expect(sitemap.items[1].origin).toBe('https://example.com/page2')
  expect(sitemap.items[2].origin).toBe('https://example.com/page3')

  // Verify documents were added to database
  const db = new LocalIndex(path.join(os.tmpdir(), 'docrepo', docbase.uuid))
  const items = await db.listItems()
  expect(items.length).toBeGreaterThan(0)

  cleanup(docbase.uuid)
})

test('addSitemap handles callback frequency', async () => {
  const { mockGetSitemapUrls } = await import('../../src/main/rag/loader')
  mockGetSitemapUrls.mockResolvedValue([
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
    'https://example.com/page4',
    'https://example.com/page5',
    'https://example.com/page6'
  ])

  const docbase = await createDocBase()
  const sitemap = new DocumentSourceImpl(crypto.randomUUID(), 'sitemap', 'https://example.com/sitemap.xml')

  const callback = vi.fn()
  await docbase.addSitemap(sitemap, callback)

  // Callback should be called at commit intervals (ADD_COMMIT_EVERY = 5) plus once at end
  expect(callback).toHaveBeenCalledTimes(2)

  cleanup(docbase.uuid)
})

test('addSitemap handles errors gracefully', async () => {
  const { mockGetSitemapUrls } = await import('../../src/main/rag/loader')
  mockGetSitemapUrls.mockResolvedValue([
    'https://example.com/page1',
    'https://example.com/page2'
  ])

  const Loader = (await import('../../src/main/rag/loader')).default
  const loadSpy = vi.spyOn(Loader.prototype, 'load')
    .mockResolvedValueOnce('Content 1')
    .mockRejectedValueOnce(new Error('Load failed'))

  const docbase = await createDocBase()
  const sitemap = new DocumentSourceImpl(crypto.randomUUID(), 'sitemap', 'https://example.com/sitemap.xml')

  const callback = vi.fn()
  await docbase.addSitemap(sitemap, callback)

  // Should have only 1 item (second one failed)
  expect(sitemap.items).toHaveLength(1)
  expect(callback).toHaveBeenCalled()

  loadSpy.mockRestore()
  cleanup(docbase.uuid)
})

test('addFolder creates child file documents', async () => {
  const { listFilesRecursively } = await import('../../src/main/file')
  vi.mocked(listFilesRecursively).mockReturnValue([
    '/path/to/file1.txt',
    '/path/to/file2.pdf'
  ])

  const docbase = await createDocBase()
  const folder = new DocumentSourceImpl(crypto.randomUUID(), 'folder', '/path/to')

  await docbase.addFolder(folder, () => {})

  expect(folder.items).toHaveLength(2)
  expect(folder.items[0].type).toBe('file')
  expect(folder.items[0].origin).toBe('/path/to/file1.txt')
  expect(folder.items[1].origin).toBe('/path/to/file2.pdf')

  cleanup(docbase.uuid)
})

test('addFolder handles callback frequency', async () => {
  const { listFilesRecursively } = await import('../../src/main/file')
  vi.mocked(listFilesRecursively).mockReturnValue([
    '/path/to/file1.txt',
    '/path/to/file2.pdf',
    '/path/to/file3.doc',
    '/path/to/file4.txt',
    '/path/to/file5.pdf',
    '/path/to/file6.doc'
  ])

  const docbase = await createDocBase()
  const folder = new DocumentSourceImpl(crypto.randomUUID(), 'folder', '/path/to')

  const callback = vi.fn()
  await docbase.addFolder(folder, callback)

  // Callback should be called at commit intervals (ADD_COMMIT_EVERY = 5) plus once at end
  expect(callback).toHaveBeenCalledTimes(2)

  cleanup(docbase.uuid)
})

test('addChildDocuments handles empty list', async () => {
  const docbase = await createDocBase()
  const parent = new DocumentSourceImpl(crypto.randomUUID(), 'folder', '/path/to')

  // Use a direct call to private method via type assertion
  await (docbase as any).addChildDocuments(parent, [], () => {})

  expect(parent.items).toHaveLength(0)

  cleanup(docbase.uuid)
})
