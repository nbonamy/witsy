
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/renderer/services/store'
import defaults from '../../defaults/settings.json'
import PromptAnywhere from '../../src/main/automations/anywhere'
import * as window from '../../src/main/window'
import { Configuration, InstructionsConfig } from '../../src/types/config'

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

beforeAll(() => {

  // init store
  store.config = defaults as unknown as Configuration
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    chat: {
      default: 'You are a chat assistant',
      titling: 'You are a titling assistant'
    }
  } as unknown as InstructionsConfig

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

