
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '@services/store'
import defaults from '@root/defaults/settings.json'
import PromptAnywhere from '@main/automations/anywhere'
import * as window from '@main/window'
import { Configuration, InstructionsConfig } from '@/types/config'

vi.mock('electron', async() => {
  return {
    BrowserWindow: {
      getFocusedWindow: vi.fn(() => null),
    },
  }
})

// mock config
vi.mock('@main/config.ts', async () => {
  return {
    loadSettings: () => defaults,
  }
})  

// mock windows
vi.mock('@main/window.ts', async () => {
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

