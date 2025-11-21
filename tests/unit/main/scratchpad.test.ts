import { beforeEach, describe, expect, test, vi } from 'vitest'
import { app } from 'electron'
import * as scratchpad from '@main/scratchpad'
import { ScratchpadData } from '@/types/index'
import fs from 'fs'
import path from 'path'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/witsy-test')
  }
}))

vi.mock('fs')
vi.mock('path')

describe('Scratchpad File Management', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'))
  })

  test('scratchpadsFolderPath creates directory', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)

    const result = scratchpad.scratchpadsFolderPath(app, 'workspace-123')

    expect(result).toBe('/tmp/witsy-test/workspaces/workspace-123/scratchpads')
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/tmp/witsy-test/workspaces/workspace-123',
      { recursive: true }
    )
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/tmp/witsy-test/workspaces/workspace-123/scratchpads',
      { recursive: true }
    )
  })

  test('listScratchpads returns sorted list', () => {
    const mockFiles = ['file1.json', 'file2.json', 'file3.txt']
    const mockData1 = { uuid: 'uuid1', title: 'Doc 1', lastModified: 1000 }
    const mockData2 = { uuid: 'uuid2', title: 'Doc 2', lastModified: 2000 }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any)
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockData1))
      .mockReturnValueOnce(JSON.stringify(mockData2))

    const result = scratchpad.listScratchpads(app, 'workspace-123')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ uuid: 'uuid2', title: 'Doc 2', lastModified: 2000 })
    expect(result[1]).toEqual({ uuid: 'uuid1', title: 'Doc 1', lastModified: 1000 })
  })

  test('loadScratchpad returns data', () => {
    const mockData = {
      uuid: 'uuid1',
      title: 'Test Doc',
      contents: { content: 'test' },
      chat: null,
      undoStack: [],
      redoStack: [],
      createdAt: 1000,
      lastModified: 2000
    }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))

    const result = scratchpad.loadScratchpad(app, 'workspace-123', 'uuid1')

    expect(result).toEqual(mockData)
    expect(fs.readFileSync).toHaveBeenCalledWith(
      '/tmp/witsy-test/workspaces/workspace-123/scratchpads/uuid1.json',
      'utf8'
    )
  })

  test('saveScratchpad updates lastModified', () => {
    const mockData: ScratchpadData = {
      uuid: 'uuid1',
      title: 'Test',
      contents: {},
      chat: null,
      createdAt: 1000,
      lastModified: 1000
    }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

    const result = scratchpad.saveScratchpad(app, 'workspace-123', mockData)

    expect(result).toBe(true)
    expect(mockData.lastModified).toBeGreaterThan(1000)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  test('renameScratchpad updates title and lastModified', () => {
    const mockData = {
      uuid: 'uuid1',
      title: 'Old Title',
      contents: {},
      chat: null,
      undoStack: [],
      redoStack: [],
      createdAt: 1000,
      lastModified: 1000
    }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

    const result = scratchpad.renameScratchpad(app, 'workspace-123', 'uuid1', 'New Title')

    expect(result).toBe(true)
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    const savedData = JSON.parse(writeCall[1] as string)
    expect(savedData.title).toBe('New Title')
    expect(savedData.lastModified).toBeGreaterThan(1000)
  })

  test('deleteScratchpad removes file', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined)

    const result = scratchpad.deleteScratchpad(app, 'workspace-123', 'uuid1')

    expect(result).toBe(true)
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      '/tmp/witsy-test/workspaces/workspace-123/scratchpads/uuid1.json'
    )
  })

  test('importScratchpad creates new scratchpad with metadata', () => {
    const externalData = {
      contents: { content: 'imported' },
      chat: null,
      undoStack: [],
      redoStack: []
    }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(externalData))
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

    const result = scratchpad.importScratchpad(app, 'workspace-123', '/external/file.json', 'Imported Doc')

    expect(result).toBeTruthy()
    expect(typeof result).toBe('string') // UUID

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0]
    const savedData = JSON.parse(writeCall[1] as string)
    expect(savedData.title).toBe('Imported Doc')
    expect(savedData.uuid).toBe(result)
    expect(savedData.createdAt).toBeGreaterThan(0)
    expect(savedData.lastModified).toBeGreaterThan(0)
  })

  test('importScratchpad handles file:// URIs', () => {
    const externalData = {
      contents: { content: 'imported from file URI' }
    }

    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(externalData))
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

    const result = scratchpad.importScratchpad(app, 'workspace-123', 'file:///Users/test/file.json', 'Test')

    expect(result).toBeTruthy()
    // Check that readFileSync was called with the path without file://
    expect(fs.readFileSync).toHaveBeenCalledWith('/Users/test/file.json', 'utf8')
  })

})
