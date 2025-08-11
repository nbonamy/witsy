

import { beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { DEFAULT_WORKSPACE_ID } from '../../src/main/workspace'
import { store } from '../../src/services/store'
import * as download from '../../src/services/download'

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

test('Get file contents', async () => {
  download.getFileContents('file://./tests/fixtures/sample.txt')
  expect(window.api.file?.read).toHaveBeenLastCalledWith('./tests/fixtures/sample.txt')
})

test('Save file', async () => {
  download.saveFileContents('txt', 'Hello')
  expect(window.api.file?.save).toHaveBeenLastCalledWith({
    contents: 'Hello',
    properties: {
      filename: expect.stringMatching(/.txt/),
      directory: 'userData',
      subdir: 'images',
      workspace: DEFAULT_WORKSPACE_ID,
      prompt: false,
    },
  })
})

test('Download file', async () => {
  download.download('https://example.com/image.jpg')
  expect(window.api.file?.download).toHaveBeenLastCalledWith({
    url: 'https://example.com/image.jpg',
    properties: {
      filename: expect.stringMatching(/.jpg/),
      directory: 'userData',
      subdir: 'images',
      workspace: DEFAULT_WORKSPACE_ID,
      prompt: false,
    },
  })
})
