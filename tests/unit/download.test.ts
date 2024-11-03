

import { beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import * as download from '../../src/services/download'

beforeAll(() => {
  useWindowMock()
})

test('Get file contents', async () => {
  download.getFileContents('file://./tests/fixtures/sample.txt')
  expect(window.api.file?.read).toHaveBeenCalledWith('./tests/fixtures/sample.txt')
})

test('Save file', async () => {
  download.saveFileContents('txt', 'Hello')
  expect(window.api.file?.save).toHaveBeenCalledWith({
    contents: 'Hello',
    properties: {
      filename: expect.stringMatching(/.txt/),
      directory: 'userData',
      subdir: 'images',
      prompt: false,
    },
  })
})

test('Download file', async () => {
  download.download('https://example.com/image.jpg')
  expect(window.api.file?.download).toHaveBeenCalledWith({
    url: 'https://example.com/image.jpg',
    properties: {
      filename: expect.stringMatching(/.jpg/),
      directory: 'userData',
      subdir: 'images',
      prompt: false,
    },
  })
})
