
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
      'image5.png',
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

test('Load history', async () => {
  const history = await loadHistory(app, 'test-workspace')
  expect(history.folders).toHaveLength(2)
  expect(history.chats).toHaveLength(3)
})

test('Backwards compatibility', async () => {
  const history = await loadHistory(app, 'test-workspace')
  expect(history.folders[0].defaults.instructions).toBe('instructions')
  expect(history.folders[0].defaults.temperature).toBeUndefined()
  expect(history.folders[0].defaults.maxTokens).toBeUndefined()
  expect(history.folders[0].defaults.verbosity).toBeUndefined()
  expect(history.folders[0].defaults.reasoningBudget).toBeUndefined()
  expect(history.folders[0].defaults.thinkingBudget).toBeUndefined()
  expect(history.folders[0].defaults.customOpts).toBeUndefined()
  expect(history.folders[0].defaults.modelOpts).toStrictEqual({
    maxTokens: 1024,
    temperature: 0.7,
    verbosity: 'detailed',
    reasoningBudget: 5,
    thinkingBudget: 10,
    customOpts: {
      key1: 'value1',
      key2: 'value2'
    }
  })
})

test('Save history', async () => {
  const history = await loadHistory(app, 'test-workspace')
  await saveHistory(app, 'test-workspace', history)
  expect(fs.writeFileSync).toHaveBeenLastCalledWith('tests/fixtures/workspaces/test-workspace/history.json', expect.any(String))
})

test('Extract attachments - invalid', async () => {
  expect(extractAttachmentsFromHistory([
    { messages: [ { content: 'Hello, world!' } ] },
    { messages: [ { content: 'http://images.image.png' } ] },
    { messages: [ { content: 'file://files/file.png' } ] },
    { messages: [ { content: 'file://images.file.png' } ] },
  ] as Chat[], 'images')).toEqual([])
})

test('Extract attachments - content', async () => {

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

test('extract attachments - attachments', async () => {

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images/image1.png' } ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [
      { url: 'file://images/image1.png' },
      { url: 'file://images folder/image2.png' }
    ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images/image1.png' } ] } ] },
    { messages: [ { attachments: [ { url: 'file://images/image2.png' } ] } ] },
  ] as Chat[], 'images')).toEqual(['image1.png', 'image2.png'])

  expect(extractAttachmentsFromHistory([
    { messages: [ { attachments: [ { url: 'file://images folder/image1.png' } ] } ] },
    { messages: [ { attachments: [ { url: 'file://images folder/image2.png' } ] } ] },
  ] as Chat[], 'images folder')).toEqual(['image1.png', 'image2.png'])

})

test('Extract attachments - mixed', async () => {

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
    { messages: [ { content: 'file://images.file6.png', attachments: [
      { url: 'file://images folder/image5.png' },
      { url: 'file://images folder/image7.png' }
    ] } ] },
  ] as Chat[], 'images folder')).toEqual(['image1.png', 'image2.png', 'image4.png', 'image5.png', 'image7.png'])

})

test('Unused attachments', async () => {
  // image3 is not listed as as unused because it mtime is too recent
  expect(listUnusedAttachments({ getPath: () => '' } as unknown as App, 'test-workspace', [
    { messages: [ { content: 'file://images/image1.png', attachments: [
      { url: 'file://images/image2.png' },
      { url: 'file://images/image5.png' }
    ] } ] },
  ] as Chat[])).toEqual(['workspaces/test-workspace/images/image1.png', 'workspaces/test-workspace/images/image2.png', 'workspaces/test-workspace/images/image4.png', 'workspaces/test-workspace/images/image5.png'])
})
