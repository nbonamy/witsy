
import { vi, expect, test } from 'vitest'
import * as file from '../../src/main/file'
import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => os.tmpdir()
    },
    dialog: {
      showOpenDialogSync: vi.fn((opts) => {
        if (opts.filters?.includes('error')) {
          throw new Error('Error')
        } else if (opts.properties.includes('openDirectory')) {
          return ['file://pickeddir']
        } else if (opts.properties.includes('multiSelections')) { 
          return ['file://picked1.txt', 'file://picked2.txt']
        } else {
          return ['file://picked.txt']
        }
      })
    },
    BrowserWindow: {
      getFocusedWindow: () => {
        return {
          webContents: {
            session: {
            }
          }
        }
      }
    }
  }
})

test('Find program', async () => {
  if (process.platform == 'win32') {
    expect(file.findProgram(app, 'notepad.exe')).toMatch(/^.*notepad.exe$/)
    expect(file.findProgram(app, 'textedit.exe')).toBeNull()
  } else {
    expect(file.findProgram(app, 'sh')).toMatch(/^.*\/sh$/)
    expect(file.findProgram(app, 'sh2')).toBeNull()
  }
})

test('Get file contents', async () => {
  expect(file.getFileContents(app, './tests/fixtures/notfound.txt')).toBeNull()
  const contents = file.getFileContents(app, './tests/fixtures/sample.txt')
  const text = Buffer.from(contents!.contents, 'base64').toString()
  expect(contents).toStrictEqual({
    url: 'file://./tests/fixtures/sample.txt',
    mimeType: 'text/plain',
    contents: 'SGVsbG8gZnJvbSBURVhU',
  })
  expect(text).toBe('Hello from TEXT')
})

test('Delete file', async () => {
  expect(file.deleteFile('file://./tests/fixtures/notfound.txt')).toBeFalsy()
  const tempFile = path.join(os.tmpdir(), 'vitest')
  fs.writeFileSync(tempFile, 'Hello')
  expect(fs.existsSync(tempFile)).toBeTruthy()
  file.deleteFile(tempFile)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})

test('Write file contents', async () => {
  const tempFile = path.join(os.tmpdir(), 'vitest')
  const fileURL = file.writeFileContents(app, {
    contents: 'SGVsbG8gZnJvbSBURVhU',
    properties: {
      filename: 'vitest'
    }
  })
  expect(fileURL).toBe(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})

test('Download unfound file', async () => {
  const fileURL = await file.downloadFile(app, {
    url: 'file://./tests/fixtures/notfound.txt',
  })
  expect(fileURL).toBeNull()
})

test('Download local file', async () => {
  const tempFile = path.join(os.tmpdir(), 'vitest')
  const fileURL = await file.downloadFile(app, {
    url: 'file://./tests/fixtures/sample.txt',
    properties: {
      filename: 'vitest',
      prompt: false,
    }
  })
  expect(fileURL).toBe(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})

test('Download remote file', async () => {
  const tempFile = path.join(os.tmpdir(), 'vitest')
  const fileURL = await file.downloadFile(app, {
    url: 'https://raw.githubusercontent.com/nbonamy/witsy/main/tests/fixtures/sample.txt',
    properties: {
      filename: 'vitest',
      prompt: false,
    }
  })
  expect(fileURL).toBe(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(`file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})

test('Pick file', async () => {
  expect(file.pickFile(app, { filters: [ { name: 'error', extensions: ['']} ] })).toBeNull()
  const fileURL = file.pickFile(app, { location: true })
  expect(dialog.showOpenDialogSync).toHaveBeenCalled()
  expect(fileURL).toBe('file://picked.txt')
})

test('Pick files', async () => {
  const fileURL = file.pickFile(app, { multiselection: true })
  expect(dialog.showOpenDialogSync).toHaveBeenCalled()
  expect(fileURL).toStrictEqual(['file://picked1.txt', 'file://picked2.txt'])
})

test('Pick directory', async () => {
  const fileURL = file.pickDirectory(app)
  expect(dialog.showOpenDialogSync).toHaveBeenCalled()
  expect(fileURL).toBe('file://pickeddir')
})

test('List files recursively', async () => {
  expect(file.listFilesRecursively('./notfound')).toStrictEqual([])
  const files = file.listFilesRecursively('./.github')

  expect(files).toEqual(expect.arrayContaining([
    '.github/workflows/build-darwin-arm64.yml',
    '.github/workflows/build-darwin-x64.yml',
    '.github/workflows/build-darwin.yml',
    '.github/workflows/build-linux-x64.yml',
    '.github/workflows/build-win32-arm64.yml',
    '.github/workflows/build-win32-x64.yml',
    '.github/workflows/test.yml',
  ].map(f => process.platform == 'win32' ? f.replace(/\//g, '\\') : f))
)})

test('Get icon contents', async () => {
  expect(file.getIconContents(app, './assets/icon.png')).toBeNull()
  const contents = file.getIconContents(app, './assets/icon.icns')
  expect(contents!.contents.length).toBe(595696)
  expect(contents).toStrictEqual({
    url: 'file://./assets/icon.icns',
    mimeType: 'image/png',
    contents: expect.stringMatching(/^iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB.*7vaBi6dlCikAAAAAElFTkSuQmCC$/),
  })
})

test('Get app info', async () => {
  if (process.platform == 'darwin') {
    expect(await file.getAppInfo(app, '/Terminal.app')).toBeNull()
    const info = await file.getAppInfo(app, '/System/Applications/Utilities/Terminal.app')
    expect(info).toStrictEqual({
      name: 'Terminal',
      identifier: 'com.apple.Terminal',
      icon: {
        url: 'file:///System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns',
        mimeType: 'image/png',
        contents: expect.any(String),
      }
    })
  }
})

test('List directory', async () => {
  const tempDir = os.tmpdir()
  const testDir = path.join(tempDir, 'test-dir')
  
  // Create test directory and files
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir)
  }
  fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content')
  fs.writeFileSync(path.join(testDir, '.hidden'), 'hidden content')
  fs.mkdirSync(path.join(testDir, 'subdir'), { recursive: true })
  
  // Test without hidden files
  const items = file.listDirectory(app, testDir, false)
  expect(items).toEqual(expect.arrayContaining([
    { name: 'test.txt', fullPath: expect.any(String), isDirectory: false, size: expect.any(Number) },
    { name: 'subdir', fullPath: expect.any(String), isDirectory: true }
  ]))
  expect(items.find(item => item.name === '.hidden')).toBeUndefined()
  
  // Test with hidden files
  const itemsWithHidden = file.listDirectory(app, testDir, true)
  expect(itemsWithHidden).toEqual(expect.arrayContaining([
    { name: 'test.txt', fullPath: expect.any(String), isDirectory: false, size: expect.any(Number) },
    { name: '.hidden', fullPath: expect.any(String), isDirectory: false, size: expect.any(Number) },
    { name: 'subdir', fullPath: expect.any(String), isDirectory: true }
  ]))
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true })
})

test('File exists', async () => {
  const tempDir = os.tmpdir()
  const testFile = path.join(tempDir, 'exists-test.txt')
  
  // File doesn't exist
  expect(file.fileExists(app, testFile)).toBe(false)
  
  // Create file
  fs.writeFileSync(testFile, 'test')
  expect(file.fileExists(app, testFile)).toBe(true)
  
  // Cleanup
  fs.unlinkSync(testFile)
})

test('Write file', async () => {
  
  const tempDir = os.tmpdir()
  const testFile = path.join(tempDir, 'test.txt')
  const content = 'test content'
  expect(() => file.writeFile(app, testFile, content)).not.toThrow()
  expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
  fs.unlinkSync(testFile)
})

test('Write new file with directory creation', async () => {
  const tempDir = os.tmpdir()
  const testDir = path.join(tempDir, 'new-dir', 'nested')
  const testFile = path.join(testDir, 'nested-file.txt')
  const content = 'nested content'
  expect(() => file.writeFile(app, testFile, content)).not.toThrow()
  expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
  fs.rmSync(path.join(tempDir, 'new-dir'), { recursive: true, force: true })
})

test('Normalize path', async () => {
  const homeDir = os.homedir()
  
  // Test tilde expansion
  expect(file.normalizePath(app, '~/Documents')).toBe(path.resolve(homeDir, 'Documents'))
  expect(file.normalizePath(app, '~')).toBe(path.resolve(homeDir))
  
  // Test relative paths (should be relative to home)
  expect(file.normalizePath(app, 'Documents')).toBe(path.resolve(homeDir, 'Documents'))
  expect(file.normalizePath(app, 'Downloads/file.txt')).toBe(path.resolve(homeDir, 'Downloads/file.txt'))
  
  // Test absolute paths (should remain unchanged)
  const absolutePath = process.platform === 'win32' ? 'C:\\temp\\file.txt' : '/tmp/file.txt'
  expect(file.normalizePath(app, absolutePath)).toBe(path.resolve(absolutePath))
  
  // Test current directory
  expect(file.normalizePath(app, '.')).toBe(path.resolve(homeDir, '.'))
  expect(file.normalizePath(app, '..')).toBe(path.resolve(homeDir, '..'))
})
