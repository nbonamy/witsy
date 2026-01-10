
import { vi, beforeEach, expect, test } from 'vitest'
import Transcriber from '@main/automations/transcriber'
import Automator from '@main/automations/automator'
import * as window from '@main/window'

// mock windows
vi.mock('@main/window.ts', async () => {
  return {
    mainWindow: {
      minimize: vi.fn(),
    },
    dictationWindow: null,
    releaseFocus: vi.fn(),
    openDictationWindow: vi.fn(),
    isMainWindowFocused: vi.fn(() => false),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Open dictation window', async () => {
  await Transcriber.initTranscription()
  expect(window.openDictationWindow).toHaveBeenCalledWith({ sourceApp: expect.anything() })
})

test('Insert transcription', async () => {
  await Transcriber.insertTranscription('Hello, World!')
  expect(window.mainWindow.minimize).toHaveBeenCalled()
  expect(window.releaseFocus).toHaveBeenCalled()
  expect(Automator.prototype.pasteText).toHaveBeenLastCalledWith('Hello, World!')
})
