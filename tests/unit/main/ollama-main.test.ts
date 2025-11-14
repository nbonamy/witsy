import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { net } from 'electron'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { mainWindow } from '../../../src/main/windows/main'
import * as IPC from '../../../src/ipc_consts'
import { startDownload, cancelDownload, openInFileExplorer, getDownloadStatus } from '../../../src/main/ollama'
import { EventEmitter } from 'events'

// Mock electron modules
vi.mock('electron', () => ({
  net: {
    request: vi.fn()
  }
}))

// Mock child_process
vi.mock('child_process')

// Mock fs
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn()
}))

// Mock path
vi.mock('path', () => ({
  join: vi.fn(),
  dirname: vi.fn()
}))

// Mock main window
vi.mock('../../../src/main/windows/main', () => ({
  mainWindow: {
    webContents: {
      send: vi.fn()
    }
  }
}))

// Mock writable stream
class MockWriteStream extends EventEmitter {
  write = vi.fn()
  close = vi.fn()
}

// Mock request with end method
class MockRequest extends EventEmitter {
  end = vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  
  // Reset module state by canceling any downloads
  try {
    cancelDownload()
  } catch {
    // Ignore errors during cleanup
  }
  
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    writable: true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('startDownload should initiate download for macOS', () => {
  const mockRequest = new MockRequest()
  const mockWriteStream = new MockWriteStream()
  
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  
  const downloadId = startDownload('/test')
  
  expect(net.request).toHaveBeenCalledWith('https://ollama.com/download/Ollama.dmg')
  expect(mockRequest.end).toHaveBeenCalled()
  expect(downloadId).toBeDefined()
  expect(typeof downloadId).toBe('string')
})

test('startDownload should throw error if download already in progress', () => {
  const mockRequest = new MockRequest()
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  
  // Start first download
  startDownload('/test')
  
  // Try to start second download
  expect(() => startDownload('/test')).toThrow('Download already in progress')
})

test('startDownload should handle download progress', () => {
  const mockRequest = new MockRequest()
  const mockResponse = new EventEmitter() as any
  const mockWriteStream = new MockWriteStream()
  
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  
  startDownload('/test')
  
  // Simulate response
  mockResponse.headers = { 'content-length': '1000' }
  mockRequest.emit('response', mockResponse)
  
  // Simulate data chunks
  const chunk = Buffer.from('test data')
  mockResponse.emit('data', chunk)
  
  expect(mockWriteStream.write).toHaveBeenCalledWith(chunk)
  expect(mainWindow?.webContents.send).toHaveBeenCalledWith(
    IPC.OLLAMA.DOWNLOAD_PROGRESS,
    expect.objectContaining({
      progress: expect.any(Number),
      downloadedBytes: chunk.length,
      totalBytes: 1000
    })
  )
})

test('startDownload should handle download completion', () => {
  const mockRequest = new MockRequest()
  const mockResponse = new EventEmitter() as any
  const mockWriteStream = new MockWriteStream()
  
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  
  startDownload('/test')
  
  // Simulate response with headers and completion
  mockResponse.headers = { 'content-length': '1000' }
  mockRequest.emit('response', mockResponse)
  mockResponse.emit('end')
  
  expect(mockWriteStream.close).toHaveBeenCalled()
  expect(mainWindow?.webContents.send).toHaveBeenCalledWith(
    IPC.OLLAMA.DOWNLOAD_COMPLETE,
    expect.objectContaining({
      filePath: '/test/Ollama.dmg'
    })
  )
})

test('startDownload should handle download error', () => {
  const mockRequest = new MockRequest()
  const mockResponse = new EventEmitter() as any
  const mockWriteStream = new MockWriteStream()
  const error = new Error('Network error')
  
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  
  startDownload('/test')
  
  // Simulate response with headers and error
  mockResponse.headers = { 'content-length': '1000' }
  mockRequest.emit('response', mockResponse)
  mockResponse.emit('error', error)
  
  expect(fs.unlinkSync).toHaveBeenCalledWith('/test/Ollama.dmg')
  expect(mainWindow?.webContents.send).toHaveBeenCalledWith(
    IPC.OLLAMA.DOWNLOAD_ERROR,
    expect.objectContaining({
      error: 'Network error'
    })
  )
})

test('cancelDownload should cancel ongoing download', () => {
  const mockRequest = new MockRequest()
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  vi.mocked(fs.existsSync).mockReturnValue(true)
  
  // Start download
  startDownload('/test')
  
  // Cancel download
  const result = cancelDownload()
  
  expect(result).toBe(true)
  expect(fs.unlinkSync).toHaveBeenCalledWith('/test/Ollama.dmg')
})

test('cancelDownload should return false if no download in progress', () => {
  const result = cancelDownload()
  expect(result).toBe(false)
})

test('openInFileExplorer should open file on macOS', () => {
  const filePath = '/test/Ollama.dmg'
  vi.mocked(path.dirname).mockReturnValue('/test')
  
  openInFileExplorer(filePath)
  
  expect(spawn).toHaveBeenCalledWith('open', ['-R', filePath])
})

test('openInFileExplorer should open file on Windows', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true
  })
  
  const filePath = 'C:\\test\\OllamaSetup.exe'
  
  openInFileExplorer(filePath)
  
  expect(spawn).toHaveBeenCalledWith('explorer', ['/select,', filePath])
})

test('openInFileExplorer should open directory on Linux', () => {
  Object.defineProperty(process, 'platform', {
    value: 'linux',
    writable: true
  })
  
  const filePath = '/test/ollama-linux-amd64'
  const directory = '/test'
  vi.mocked(path.dirname).mockReturnValue(directory)
  
  openInFileExplorer(filePath)
  
  expect(spawn).toHaveBeenCalledWith('xdg-open', [directory])
})

test('getDownloadStatus should return null when no download', () => {
  const status = getDownloadStatus()
  expect(status).toBeNull()
})

test('getDownloadStatus should return current download state', () => {
  const mockRequest = new MockRequest()
  vi.mocked(net.request).mockReturnValue(mockRequest as any)
  vi.mocked(path.join).mockReturnValue('/test/Ollama.dmg')
  
  startDownload('/test')
  
  const status = getDownloadStatus()
  expect(status).toEqual(expect.objectContaining({
    downloadId: expect.any(String),
    filePath: '/test/Ollama.dmg',
    totalBytes: 0,
    downloadedBytes: 0,
    cancelled: false
  }))
})
