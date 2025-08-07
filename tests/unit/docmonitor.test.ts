import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import DocumentMonitor from '../../src/rag/docmonitor'
import DocumentSourceImpl from '../../src/rag/docsource'
import { watch as chokidarWatch } from 'chokidar'
import fs from 'fs'
import { app } from 'electron'
import os from 'os'

// Mock electron
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

// Mock chokidar
const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn(),
}

vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatcher),
}))

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    rmSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  rmSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

// Mock DocumentRepository
const mockDocRepo = {
  contents: [] as any[],
  addDocument: vi.fn().mockResolvedValue('mock-doc-id'),
  addDocumentSource: vi.fn().mockResolvedValue('mock-doc-id'),
  addChildDocumentSource: vi.fn().mockResolvedValue('mock-child-doc-id'),
  removeDocument: vi.fn().mockResolvedValue(undefined),
  removeDocumentSource: vi.fn().mockResolvedValue(undefined),
  removeChildDocumentSource: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}

// Mock DocumentBaseImpl
const mockDocBase = {
  uuid: 'test-base-id',
  name: 'Test Base',
  documents: [] as any[],
}

const cleanup = () => {
  vi.clearAllMocks()
  mockWatcher.on.mockReturnThis()
  mockWatcher.close.mockClear()
  mockDocRepo.contents = []
  // Reset mock implementations
  mockDocRepo.addDocument = vi.fn().mockResolvedValue('mock-doc-id')
  mockDocRepo.addDocumentSource = vi.fn().mockResolvedValue('mock-doc-id')
  mockDocRepo.addChildDocumentSource = vi.fn().mockResolvedValue('mock-child-doc-id')
  mockDocRepo.removeDocument = vi.fn().mockResolvedValue(undefined)
  mockDocRepo.removeDocumentSource = vi.fn().mockResolvedValue(undefined)
  mockDocRepo.removeChildDocumentSource = vi.fn().mockResolvedValue(undefined)
  mockDocRepo.addListener = vi.fn()
  mockDocRepo.removeListener = vi.fn()
}

beforeEach(() => {
  cleanup()
})

afterEach(() => {
  cleanup()
})

test('DocMonitor constructor initializes correctly', () => {
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  expect(monitor.app).toBe(app)
  expect(monitor.docRepo).toBe(mockDocRepo)
  expect(monitor.watchers).toBeInstanceOf(Map)
  expect(monitor.pendingOperations).toBeInstanceOf(Map)
  expect(monitor.debounceDelay).toBe(1000)
})

test('DocMonitor start() sets up watchers for existing documents', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  const urlDoc = new DocumentSourceImpl('url-doc-id', 'url', 'https://example.com')
  
  mockDocBase.documents = [fileDoc, folderDoc, urlDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  // Should call chokidar watch for file and folder, but not URL
  expect(vi.mocked(chokidarWatch)).toHaveBeenCalledTimes(2)
  expect(vi.mocked(chokidarWatch)).toHaveBeenCalledWith('/path/to/file.txt', expect.any(Object))
  expect(vi.mocked(chokidarWatch)).toHaveBeenCalledWith('/path/to/folder', expect.any(Object))
  
  // Should set up event listeners
  expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function))
  expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function))
  expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function))
  expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function))
})

test('DocMonitor start() skips non-existent paths', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/nonexistent/file.txt')
  
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(false)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  
  monitor.start()
  
  expect(vi.mocked(chokidarWatch)).not.toHaveBeenCalled()
  expect(consoleSpy).toHaveBeenCalledWith('[docmonitor] Path does not exist: /nonexistent/file.txt')
  
  consoleSpy.mockRestore()
})

test('DocMonitor stop() closes all watchers and clears pending operations', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  // Add a pending operation
  const mockTimer = { ref: vi.fn(), unref: vi.fn() } as any
  monitor.pendingOperations.set('/some/path', {
    path: '/some/path',
    operation: 'add',
    timer: mockTimer,
  })
  
  const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
  
  monitor.stop()
  
  expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimer)
  expect(monitor.pendingOperations.size).toBe(0)
  expect(mockWatcher.close).toHaveBeenCalled()
  expect(monitor.watchers.size).toBe(0)
  
  clearTimeoutSpy.mockRestore()
})

test('DocMonitor handles file add event', () => {
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  // Get the add event handler
  const addHandler = mockWatcher?.on?.mock?.calls?.find(call => call[0] === 'add')?.[1]
  
  // Set up setTimeout mock
  const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
  
  addHandler('/path/to/folder/newfile.txt')
  
  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1500)
  expect(monitor.pendingOperations.has('/path/to/folder/newfile.txt')).toBe(true)
  
  setTimeoutSpy.mockRestore()
})

test('DocMonitor handles file change event', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  // Get the change event handler
  const changeHandler = mockWatcher?.on?.mock?.calls?.find(call => call[0] === 'change')?.[1]

  const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
  
  changeHandler('/path/to/file.txt')
  
  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
  expect(monitor.pendingOperations.has('/path/to/file.txt')).toBe(true)
  
  setTimeoutSpy.mockRestore()
})

test('DocMonitor handles file unlink event', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  // Get the unlink event handler
  const unlinkHandler = mockWatcher?.on?.mock?.calls?.find(call => call[0] === 'unlink')?.[1]

  const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
  
  unlinkHandler('/path/to/file.txt')
  
  expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
  expect(monitor.pendingOperations.has('/path/to/file.txt')).toBe(true)
  
  setTimeoutSpy.mockRestore()
})

test('DocMonitor debounces multiple events for same file', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()

  const changeHandler = mockWatcher?.on?.mock?.calls?.find(call => call[0] === 'change')?.[1]

  const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
  const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
  
  // First event
  changeHandler('/path/to/file.txt')
  const firstTimer = monitor.pendingOperations.get('/path/to/file.txt')?.timer
  
  // Second event should clear the first timer
  changeHandler('/path/to/file.txt')
  const secondTimer = monitor.pendingOperations.get('/path/to/file.txt')?.timer
  
  expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimer)
  expect(firstTimer).not.toBe(secondTimer)
  
  setTimeoutSpy.mockRestore()
  clearTimeoutSpy.mockRestore()
})

test('DocMonitor findAffectedDocBases finds correct docbases', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  const otherDoc = new DocumentSourceImpl('other-doc-id', 'file', '/other/file.txt')
  
  mockDocBase.documents = [fileDoc, folderDoc, otherDoc]
  mockDocRepo.contents = [mockDocBase]
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Test direct file match
  const affected1 = monitor['findAffectedDocBases']('/path/to/file.txt')
  expect(affected1).toHaveLength(1)
  expect(affected1[0].docSource).toBe(fileDoc)
  
  // Test folder match
  const affected2 = monitor['findAffectedDocBases']('/path/to/folder/subfile.txt')
  expect(affected2).toHaveLength(1)
  expect(affected2[0].docSource).toBe(folderDoc)
  
  // Test no match
  const affected3 = monitor['findAffectedDocBases']('/unrelated/file.txt')
  expect(affected3).toHaveLength(0)
})

test('DocMonitor isFileAffectedByDocSource works correctly', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  const urlDoc = new DocumentSourceImpl('url-doc-id', 'url', 'https://example.com')
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Direct file match
  expect(monitor['isFileAffectedByDocSource']('/path/to/file.txt', fileDoc)).toBe(true)
  expect(monitor['isFileAffectedByDocSource']('/other/file.txt', fileDoc)).toBe(false)
  
  // Folder match
  expect(monitor['isFileAffectedByDocSource']('/path/to/folder/subfile.txt', folderDoc)).toBe(true)
  expect(monitor['isFileAffectedByDocSource']('/path/to/folder', folderDoc)).toBe(false) // exact match is not considered "within"
  expect(monitor['isFileAffectedByDocSource']('/other/path/file.txt', folderDoc)).toBe(false)
  
  // URL should not match any file path
  expect(monitor['isFileAffectedByDocSource']('/any/file.txt', urlDoc)).toBe(false)
})

test('DocMonitor registers and unregisters as listener', () => {
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  monitor.start()
  expect(mockDocRepo.addListener).toHaveBeenCalledWith(monitor)
  
  monitor.stop()
  expect(mockDocRepo.removeListener).toHaveBeenCalledWith(monitor)
})

test('DocMonitor onDocumentSourceAdded creates watcher', () => {
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  monitor.onDocumentSourceAdded('base-id', 'doc-id', 'file', '/path/to/newfile.txt')
  
  expect(vi.mocked(chokidarWatch)).toHaveBeenCalledWith('/path/to/newfile.txt', expect.any(Object))
})

test('DocMonitor onDocumentSourceRemoved removes watcher', () => {
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  // First add a watcher
  monitor.onDocumentSourceAdded('base-id', 'doc-id', 'file', '/path/to/file.txt')
  
  // Then remove it
  monitor.onDocumentSourceRemoved('base-id', 'doc-id', '/path/to/file.txt')
  
  expect(mockWatcher.close).toHaveBeenCalled()
})

test('DocMonitor handles processFileEvent for add operation', async () => {
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  await monitor['processFileEvent']('/path/to/folder/newfile.txt', 'add')
  
  expect(mockDocRepo.addChildDocumentSource).toHaveBeenCalledWith('test-base-id', 'folder-doc-id', 'file', '/path/to/folder/newfile.txt')
})

test('DocMonitor handles processFileEvent for change operation', async () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  await monitor['processFileEvent']('/path/to/file.txt', 'change')
  
  // For change events, it should re-add the document (which updates it)
  expect(mockDocRepo.addDocumentSource).toHaveBeenCalledWith('test-base-id', 'file', '/path/to/file.txt')
})

test('DocMonitor handles processFileEvent for unlink operation', async () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  await monitor['processFileEvent']('/path/to/file.txt', 'unlink')
  
  expect(mockDocRepo.removeDocumentSource).toHaveBeenCalledWith('test-base-id', 'file-doc-id')
})

test('DocMonitor handles errors gracefully', () => {
  const fileDoc = new DocumentSourceImpl('file-doc-id', 'file', '/path/to/file.txt')
  mockDocBase.documents = [fileDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  vi.mocked(chokidarWatch).mockImplementation(() => {
    throw new Error('Chokidar error')
  })
  
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  monitor.start()
  
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[docmonitor] Failed to create watcher'),
    expect.any(Error)
  )
  
  consoleSpy.mockRestore()
})

test('DocMonitor handles processFileEvent errors', async () => {
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  // Make addChildDocumentSource throw an error
  mockDocRepo.addChildDocumentSource.mockRejectedValue(new Error('Add document failed'))
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  await monitor['processFileEvent']('/path/to/folder/newfile.txt', 'add')
  
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[docmonitor] Error processing add for'),
    expect.any(Error)
  )
  
  consoleSpy.mockRestore()
})

test('DocMonitor handles folder documents with sub-items', () => {
  const subItem = new DocumentSourceImpl('sub-item-id', 'file', '/path/to/folder/subfile.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  folderDoc.items = [subItem]
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Should find the sub-item
  const affected = monitor['isFileAffectedByDocSource']('/path/to/folder/subfile.txt', folderDoc)
  expect(affected).toBe(true)
  
  // Should not find unrelated file
  const notAffected = monitor['isFileAffectedByDocSource']('/other/file.txt', folderDoc)
  expect(notAffected).toBe(false)
})

test('DocMonitor adds files to folder as child items, not root documents', async () => {
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Process adding a file inside the folder
  await monitor['processFileEvent']('/path/to/folder/newfile.txt', 'add')
  
  // Should call addChildDocumentSource with correct parameters
  expect(mockDocRepo.addChildDocumentSource).toHaveBeenCalledWith('test-base-id', 'folder-doc-id', 'file', '/path/to/folder/newfile.txt')
  
  // Should NOT call addDocumentSource (which would create a root-level document)
  expect(mockDocRepo.addDocumentSource).not.toHaveBeenCalled()
})

test('DocMonitor removes files from folder as child items, not from root', async () => {
  const childFile = new DocumentSourceImpl('child-file-id', 'file', '/path/to/folder/existingfile.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  folderDoc.items = [childFile]
  mockDocBase.documents = [folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Process removing a file inside the folder
  await monitor['processFileEvent']('/path/to/folder/existingfile.txt', 'unlink')
  
  // Should call removeChildDocumentSource for child items
  expect(mockDocRepo.removeChildDocumentSource).toHaveBeenCalledWith('test-base-id', 'child-file-id')
  
  // Should NOT call removeDocumentSource (which would remove from root)
  expect(mockDocRepo.removeDocumentSource).not.toHaveBeenCalled()
})

test('DocMonitor handles file move from root to folder correctly', async () => {
  // Setup: both a root file and a folder are monitored
  const rootFile = new DocumentSourceImpl('root-file-id', 'file', '/path/to/file.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [rootFile, folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Simulate file move: first unlink event from original location
  await monitor['processFileEvent']('/path/to/file.txt', 'unlink')
  
  // Should remove the root document
  expect(mockDocRepo.removeDocumentSource).toHaveBeenCalledWith('test-base-id', 'root-file-id')
  
  // Reset mocks for the second part
  vi.clearAllMocks()
  mockDocRepo.addChildDocumentSource = vi.fn().mockResolvedValue('new-child-id')
  
  // Then add event in the folder location
  await monitor['processFileEvent']('/path/to/folder/file.txt', 'add')
  
  // Should add as child to folder
  expect(mockDocRepo.addChildDocumentSource).toHaveBeenCalledWith('test-base-id', 'folder-doc-id', 'file', '/path/to/folder/file.txt')
})

test('DocMonitor cleans up duplicate documents after adding to folder', async () => {
  // Setup: file exists as both root document and will be added to folder
  const rootFile = new DocumentSourceImpl('root-file-id', 'file', '/path/to/folder/newfile.txt')
  const folderDoc = new DocumentSourceImpl('folder-doc-id', 'folder', '/path/to/folder')
  mockDocBase.documents = [rootFile, folderDoc]
  mockDocRepo.contents = [mockDocBase]
  
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  // Mock addChildDocumentSource to actually add the child to folder items (simulate real behavior)
  mockDocRepo.addChildDocumentSource = vi.fn().mockImplementation((baseId, parentId, type, origin) => {
    const childDoc = new DocumentSourceImpl('new-child-id', type, origin)
    folderDoc.items.push(childDoc)
    return Promise.resolve('new-child-id')
  })
  
  const monitor = new DocumentMonitor(app, mockDocRepo as any)
  
  // Simulate adding a file to folder (which should trigger duplicate cleanup)
  await monitor['processFileEvent']('/path/to/folder/newfile.txt', 'add')
  
  // Should add as child to folder
  expect(mockDocRepo.addChildDocumentSource).toHaveBeenCalledWith('test-base-id', 'folder-doc-id', 'file', '/path/to/folder/newfile.txt')
  
  // Should also remove the duplicate root document
  expect(mockDocRepo.removeDocumentSource).toHaveBeenCalledWith('test-base-id', 'root-file-id')
})