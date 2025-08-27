
import { vi, beforeEach, expect, test } from 'vitest'
import { app, Notification } from 'electron'
import ReadAloud from '../../src/automations/readaloud'
import Automator from '../../src/automations/automator'
import * as window from '../../src/main/window'
import * as utils from '../../src/main/utils'

// mock electron
vi.mock('electron', async() => {
  const Notification = vi.fn();
  Notification.prototype.show = vi.fn();
  return {
    app: {
      getPath: vi.fn(() => ''),
      getLocale: vi.fn(() => 'en-US'),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((data) => `encrypted-${data}`),
      decryptString: vi.fn((data) => data.toString('latin1'))
    },
    Notification
  }
})

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    releaseFocus: vi.fn(),
    openReadAloudPalette: vi.fn(),
    isMainWindowFocused: vi.fn(() => false),
  }
})

vi.mock('../../src/main/utils', async () => {
  return {
    wait: vi.fn(),
    putCachedText: vi.fn(() => 'textId')
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Open readaloud window', async () => {

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue('Grabbed text')
  
  await ReadAloud.read(app, 100)
  expect(utils.putCachedText).toHaveBeenLastCalledWith('Grabbed text')
  expect(window.openReadAloudPalette).toHaveBeenLastCalledWith({
    textId: 'textId',
    sourceApp: "{\"id\":\"appId\",\"name\":\"appName\",\"path\":\"appPath\",\"window\":\"title\"}"
  })

})

test('Show no text error notification', async () => {

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue('')
  
  await ReadAloud.read(app, 100)
  expect(utils.putCachedText).not.toHaveBeenCalled()
  expect(window.openReadAloudPalette).not.toHaveBeenCalled()
    expect(Notification).toHaveBeenLastCalledWith({ title: 'Witsy', body: 'Please highlight the text you want to read aloud.' })

  })

test('Show no grab error notification', async () => {

  vi.mocked(Automator.prototype.getSelectedText).mockResolvedValue(null as any)
  
  await ReadAloud.read(app, 100)
  expect(utils.putCachedText).not.toHaveBeenCalled()
  expect(window.openReadAloudPalette).not.toHaveBeenCalled()
  expect(Notification).toHaveBeenLastCalledWith({ title: 'Witsy', body: 'An error occurred while trying to grab the text. Please check Privacy & Security settings.' })

})
