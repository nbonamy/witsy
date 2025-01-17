
import { vi, beforeEach, expect, test } from 'vitest'
import { Notification } from 'electron'
import ReadAloud from '../../src/automations/readaloud'
import * as window from '../../src/main/window'

// mock electron
vi.mock('electron', async() => {
  const Notification = vi.fn();
  Notification.prototype.show = vi.fn();
  return {
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

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  let call = -1
  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  Automator.prototype.getSelectedText = vi.fn(() => {
    if (++call === 0) return 'Grabbed text'
    else if (call === 1) return ''
    else return null
  })
  return { default: Automator }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Open readaloud window', async () => {
  await ReadAloud.read()
  expect(window.openReadAloudPalette).toHaveBeenCalledWith({
    textId: 'textId',
    sourceApp: "{\"id\":\"appId\",\"name\":\"appName\",\"path\":\"appPath\",\"window\":\"title\"}"
  })
})

test('Show no text error notification', async () => {
  await ReadAloud.read()
  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: 'Please highlight the text you want to read aloud' })
})

test('Show no grab error notification', async () => {
  await ReadAloud.read()
  expect(Notification).toHaveBeenCalledWith({ title: 'Witsy', body: 'An error occurred while trying to grab the text. Please check Privacy & Security settings.' })
})
