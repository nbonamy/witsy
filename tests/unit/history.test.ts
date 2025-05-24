
import { expect, test, vi } from 'vitest'
import { extractAttachmentsFromHistory, listUnusedAttachments, loadHistory, saveHistory, kUnusedDelay } from '../../src/main/history'
import { App, app } from 'electron'
import Chat from '../../src/models/chat'
import fs from 'fs'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => './tests/fixtures',
    },
  }
})
  
vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { default: {
    ...mod,
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => [
      'image1.png',
      'image2.png',
      'image3.jpg',
      'image4.png',
    ]),
    statSync: vi.fn((file) => {
      return {
        mtime: file.includes('image3')
          ? new Date(new Date().getTime() - kUnusedDelay * 0.9)
          : new Date(new Date().getTime() - kUnusedDelay * 1.1)
      }
    })
  }}
})

test('load history', async () => {
  const history = await loadHistory(app)
  expect(history.folders).toHaveLength(2)
  expect(history.chats).toHaveLength(3)
})

test('save history', async () => {
  const history = await loadHistory(app)
  await saveHistory(app, history)
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('tests/fixtures/history.json', expect.any(String))
})

test('extract attachments - invalid', async () => {
  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'http://images.image.png' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images.file.png' } ] },
  ] as Chat[], 'images')).toEqual([])
})

test('extract attachments - content', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image.png' } ] }
  ] as Chat[], 'images')).toEqual(['image.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: '<img src="file://images/image.png">' } ] }
  ] as Chat[], 'images')).toEqual(['image.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: '<video controls src="file://images/video.mp4">' } ] }
  ] as Chat[], 'images')).toEqual(['video.mp4'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image1.png' } ] },
    { messages: [ { content: 'file://images/image2.png' } ] },
    { messages: [ { content: '<video controls src="file://images/video.mp4">' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'video.mp4'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: '[image1](file://images/image1.png)' } ] },
    { messages: [ { content: '[image2](file://images/image2.png)[image3](file://images/image3.png)' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images/image1.png' } ] },
    { messages: [ { content: '[image2](file://images/image2.png)<img src="file://images/image3.png">' } ] }
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'file://images folder/image1.png' } ] },
    { messages: [ { content: 'file://images%20folder/image2.png' } ] },
    { messages: [ { content: '[image3](file://images folder/image3.png)<video controls src="file://images folder/video.mp4">' } ] }
  ] as Chat[], 'images folder')).toEqual(['image1.png', 'image2.png', 'image3.png', 'video.mp4'])

})

test('extract attachments - attachment', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images/image1.png' } ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images/image1.png' } ] } ] },
    { messages: [ { attachments: [ { url: 'file://images/image2.png' } ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images folder/image1.png' } ] } ] },
    { messages: [ { attachments: [ { url: 'file://images folder/image2.png' } ] } ] },
  ] as Chat[], 'images folder')).toEqual(['image1.png', 'image2.png'])

})

test('extract attachments - mixed', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images/image1.png', attachments: [ { url: 'file://images/image2.png' } ] } ] },
    { messages: [ { content: '[image3](file://images/image3.png)' } ] },
    { messages: [ { content: 'file://images/image4.png' } ] },
    { messages: [ { content: 'file://images.file6.png', attachments: [ { url: 'file://images/image5.png' } ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png', 'image3.png', 'image4.png', 'image5.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images folder/image1.png', attachments: [ { url: 'file://images folder/image2.png' } ] } ] },
    { messages: [ { content: '[image3](file://images/image3.png)' } ] },
    { messages: [ { content: 'file://images folder/image4.png' } ] },
    { messages: [ { content: 'file://images.file6.png', attachments: [ { url: 'file://images folder/image5.png' } ] } ] },
  ] as Chat[], 'images folder')).toEqual(['image1.png', 'image2.png', 'image4.png', 'image5.png'])

})

test('unused attachments', async () => {
  expect(listUnusedAttachments({ getPath: () => '' } as unknown as App, [
    { messages: [ { content: 'file://images/image1.png', attachments: [ { url: 'file://images/image2.png' } ] } ] },
  ] as Chat[])).toEqual(['images/image4.png'])
})
