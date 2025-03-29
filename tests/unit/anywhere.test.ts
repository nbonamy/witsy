
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import PromptAnywhere from '../../src/automations/anywhere'
import * as window from '../../src/main/window'

vi.mock('electron', async() => {
  return {
    BrowserWindow: {
      getFocusedWindow: vi.fn(() => null),
    },
  }
})

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => defaults,
  }
})  

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    promptAnywhereWindow: null,
    openPromptAnywhere: vi.fn(),
    closePromptAnywhere: vi.fn(),
    releaseFocus: vi.fn(),
    openMainWindow: vi.fn(),
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  Automator.prototype.moveCaretBelow =  vi.fn()
  Automator.prototype.getSelectedText = vi.fn(() => 'Grabbed text')
  Automator.prototype.pasteText = vi.fn()
  Automator.prototype.copyToClipboard = vi.fn()
  return { default: Automator }
})

beforeAll(() => {

  // init store
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    default: 'You are a chat assistant',
    titling: 'You are a titling assistant'
  }

})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Prepare prompt', async () => {
  await PromptAnywhere.open()
  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()
})

test('Close prompt', async () => {
  await PromptAnywhere.close()
  expect(window.closePromptAnywhere).toHaveBeenCalledOnce()
})

