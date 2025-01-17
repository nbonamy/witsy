
import { vi, beforeEach, expect, test } from 'vitest'
import Transcriber from '../../src/automations/transcriber'
import Automator from '../../src/automations/automator'
import * as window from '../../src/main/window'

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    releaseFocus: vi.fn(),
    openTranscribePalette: vi.fn(),
    closeTranscribePalette: vi.fn(),
    isMainWindowFocused: vi.fn(() => false),
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.pasteText = vi.fn()
  return { default: Automator }
})


beforeEach(() => {
  vi.clearAllMocks()
})

test('Open transcriber window', async () => {
  await Transcriber.initTranscription()
  expect(window.openTranscribePalette).toHaveBeenCalledWith()
})

test('Insert transcription', async () => {
  await Transcriber.insertTranscription('Hello, World!')
  expect(window.closeTranscribePalette).toHaveBeenCalled()
  expect(window.releaseFocus).toHaveBeenCalled()
  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('Hello, World!')
})
