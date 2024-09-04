
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import * as window from '../../src/main/window'
import PromptAnywhere from '../../src/automations/anywhere'
import Automator from '../../src/automations/automator'
import LlmMock from '../mocks/llm'

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => defaults,
  }
})  

// mock windows
vi.mock('../../src/main/window.ts', async () => {
  return {
    openPromptAnywhere: vi.fn(),
    openWaitingPanel: vi.fn(),
    closeWaitingPanel: vi.fn(),
    hideWindows: vi.fn(),
    restoreWindows: vi.fn(),
    releaseFocus: vi.fn()
  }
})

// mock automator
vi.mock('../../src/automations/automator.ts', async () => {
  const Automator = vi.fn()
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
  store.config.getActiveModel = () => 'chat'

})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Prepare prompt', async () => {

  await PromptAnywhere.initPrompt()

  expect(window.hideWindows).toHaveBeenCalledOnce()
  expect(window.openPromptAnywhere).toHaveBeenCalledOnce()

})

test('Execute Prompt', async () => {

  const anywhere = new PromptAnywhere(new LlmMock(store.config))
  await anywhere.execPrompt(null, 'Explain this')

  expect(window.openWaitingPanel).toHaveBeenCalledOnce()
  expect(window.closeWaitingPanel).toHaveBeenCalledOnce()
  expect(window.restoreWindows).toHaveBeenCalledOnce()

  expect(Automator.prototype.pasteText).toHaveBeenCalledWith('[{"role":"user","content":"Explain this"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')

})

test('Cancel Prompt', async () => {

  const anywhere = new PromptAnywhere(new LlmMock(store.config))
  await anywhere.cancel()

  expect(window.closeWaitingPanel).toHaveBeenCalledOnce()
  expect(window.restoreWindows).toHaveBeenCalledOnce()
  expect(window.releaseFocus).toHaveBeenCalledOnce()

  await anywhere.execPrompt(null, 'Explain this')

  expect(Automator.prototype.pasteText).not.toHaveBeenCalled()

})
