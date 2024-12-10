
import { vi, expect, test } from 'vitest'
import * as file from '../../src/main/file'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => os.tmpdir()
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
  expect(file.findProgram(app, 'sh')).toMatch(/^.*\/sh$/)
  expect(file.findProgram(app, 'sh2')).toBeNull()
})

test('Get file contents', async () => {
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
