
import { vi, beforeEach, expect, test } from 'vitest'
import { createAutomatorMock } from '../mocks'
import Transcriber from '../../src/automations/transcriber'
import Automator from '../../src/automations/automator'
import * as window from '../../src/main/window'

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    mainWindow: {
      minimize: vi.fn(),
    },
    releaseFocus: vi.fn(),
    openTranscribePalette: vi.fn(),
    closeTranscribePalette: vi.fn(),
    isMainWindowFocused: vi.fn(() => false),
  }
})

vi.mock('../../src/automations/automator.ts', async () => {
  return createAutomatorMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Open transcriber window', async () => {
  await Transcriber.initTranscription()
  expect(window.openTranscribePalette).toHaveBeenLastCalledWith()
})

test('Insert transcription', async () => {
  await Transcriber.insertTranscription('Hello, World!')
  expect(window.mainWindow.minimize).toHaveBeenCalled()
  expect(window.releaseFocus).toHaveBeenCalled()
  expect(Automator.prototype.pasteText).toHaveBeenLastCalledWith('Hello, World!')
})
