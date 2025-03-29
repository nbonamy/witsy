
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
  const text = Buffer.from(contents.contents, 'base64').toString()
  expect(contents).toStrictEqual({
    url: 'file://./tests/fixtures/sample.txt',
    mimeType: 'text/plain',
    contents: 'SGVsbG8gZnJvbSBURVhU',
  })
  expect(text).toBe('Hello from TEXT')
})

test('Delete file', async () => {
  expect(file.deleteFile(app, 'file://./tests/fixtures/notfound.txt')).toBeFalsy()
  const tempFile = path.join(os.tmpdir(), 'vitest')
  fs.writeFileSync(tempFile, 'Hello')
  expect(fs.existsSync(tempFile)).toBeTruthy()
  file.deleteFile(app, tempFile)
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
  file.deleteFile(app, `file://${tempFile}`)
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
  file.deleteFile(app, `file://${tempFile}`)
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
  file.deleteFile(app, `file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})

test('Pick file', async () => {
  expect(file.pickFile(app, { filters: [ 'error'] })).toBeNull()
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
  expect(files).toStrictEqual([
    '.github/FUNDING.yml',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',
    '.github/dependabot.yml',
    '.github/workflows/build-darwin-arm64.yml',
    '.github/workflows/build-darwin-x64.yml',
    '.github/workflows/build-darwin.yml',
    '.github/workflows/build-linux.yml',
    '.github/workflows/build-windows.yml',
    '.github/workflows/test.yml',
  ].map(f => process.platform == 'win32' ? f.replace(/\//g, '\\') : f))
})

test('Get icon contents', async () => {
  expect(file.getIconContents(app, './assets/icon.png')).toBeNull()
  const contents = file.getIconContents(app, './assets/icon.icns')
  expect(contents.contents.length).toBe(595696)
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
