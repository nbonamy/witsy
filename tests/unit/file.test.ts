
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

vi.mock('electron-dl', async() => {
  return {
    download: async (win: any, url: string, options: any) => {
      const response = await fetch(url)
      const contents = await response.text()
      options.onProgress(0)
      fs.writeFileSync(path.join(options.directory, options.filename), contents)
      options.onProgress(100)
      options.onCompleted()
      return path.join(options.directory, options.filename)
    }
  }
})

test('Find program', async () => {
  expect(file.findProgram(null, 'sh')).toBe('/bin/sh')
  expect(file.findProgram(null, 'sh2')).toBeNull()
})

test('Get file contents', async () => {
  const contents = file.getFileContents(app, './tests/fixtures/sample.txt')
  const text = Buffer.from(contents.contents, 'base64').toString()
  expect(contents).toStrictEqual({
    url: 'file://./tests/fixtures/sample.txt',
    contents: 'SGVsbG8gZnJvbSBURVhU',
  })
  expect(text).toContain('Hello from TEXT')
})

test('Delete file', async () => {
  const tempFile = path.join(os.tmpdir(), 'vitest')
  fs.writeFileSync(tempFile, 'Hello')
  expect(fs.existsSync(tempFile)).toBeTruthy()
  file.deleteFile(null, tempFile)
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
  expect(fileURL).toBe(tempFile)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(null, `file://${tempFile}`)
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
  expect(fileURL).toBe(tempFile)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(null, `file://${tempFile}`)
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
  expect(fileURL).toBe(tempFile)
  expect(fs.existsSync(tempFile)).toBeTruthy()
  expect(fs.readFileSync(tempFile, 'utf8')).toBe('Hello from TEXT')
  file.deleteFile(null, `file://${tempFile}`)
  expect(fs.existsSync(tempFile)).toBeFalsy()
})
