
import { expect, test, vi, describe, Mock, beforeEach } from 'vitest'
import { extractAttachmentsFromHistory, listUnusedAttachments, loadHistory, saveHistory, kUnusedDelay } from '@main/history'
import { App, app } from 'electron'
import { kHistoryVersion } from '@/consts'
import Chat from '@models/chat'
import fs from 'fs'
import { History } from '@/types/index'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => './tests/fixtures',
    },
  }
})
  
vi.mock('fs', async (importOriginal) => {
  const mod: any = await importOriginal()
  const realReadFileSync = mod.readFileSync
  return { default: {
    ...mod,
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn((path: string, encoding?: string) => realReadFileSync(path, encoding)),
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

beforeEach(() => {
  vi.clearAllMocks()
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

describe('Version handling', () => {

  test('Load history with current version', async () => {
    const history = await loadHistory(app, 'test-workspace')
    expect(history.version).toBe(kHistoryVersion)
    expect(history.folders).toHaveLength(2)
    expect(history.chats).toHaveLength(3)
  })

  test('Load history without version (backward compatibility)', async () => {
    const history = await loadHistory(app, 'version-test-no-version')
    expect(history.version).toBe(kHistoryVersion)
    expect(history.folders).toHaveLength(0)
    expect(history.chats).toHaveLength(0)
  })

  test('Load history with array format (backward compatibility)', async () => {
    const history = await loadHistory(app, 'version-test-array')
    expect(history.version).toBe(kHistoryVersion)
    expect(history.folders).toHaveLength(0)
    expect(history.chats).toHaveLength(2)
    expect(history.quickPrompts).toHaveLength(0)
  })

  test('Load history with newer version', async () => {
    const history = await loadHistory(app, 'version-test-newer')
    expect(history.version).toBe(999)
    expect(history.folders).toHaveLength(0)
    expect(history.chats).toHaveLength(0)
    expect(history.quickPrompts).toHaveLength(0)
  })

  test('Load history with version 0 (treated as no version)', async () => {
    const history = await loadHistory(app, 'version-test-older')
    // Version 0 is falsy, so treated same as missing version - gets upgraded
    expect(history.version).toBe(kHistoryVersion)
    expect(history.folders).toHaveLength(1)
    expect(history.chats).toHaveLength(1)
    expect(history.quickPrompts).toHaveLength(1)
  })

  test('Save history with current version', async () => {
    const history: History = {
      version: kHistoryVersion,
      folders: [],
      chats: [],
      quickPrompts: []
    }

    saveHistory(app, 'version-test', history)
    expect(fs.writeFileSync).toHaveBeenCalled()

    const savedData = JSON.parse((fs.writeFileSync as Mock).mock.calls[0][1])
    expect(savedData.version).toBe(kHistoryVersion)
  })

  test('Save history with newer version does not write', async () => {
    vi.clearAllMocks()
    const history: History = {
      version: kHistoryVersion + 1,
      folders: [],
      chats: [],
      quickPrompts: []
    }

    saveHistory(app, 'version-test', history)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  test('Save history with older version does not write', async () => {
    vi.clearAllMocks()
    const history: History = {
      version: kHistoryVersion - 1,
      folders: [],
      chats: [],
      quickPrompts: []
    }

    saveHistory(app, 'version-test', history)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  test('Loaded history always gets current version assigned', async () => {
    const history = await loadHistory(app, 'version-test-no-version')
    expect(history.version).toBe(kHistoryVersion)
  })
})
