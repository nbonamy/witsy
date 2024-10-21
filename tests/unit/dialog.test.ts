
import { vi, test, expect, beforeEach } from 'vitest'
import { store } from '../../src/services/store'
import useTipsManager from '../../src/composables/tips_manager'

beforeEach(() => {

  window.api = {
    showDialog: vi.fn(() => Promise.resolve({ response: 1, checkboxChecked: false })),
    config: {
      save: vi.fn(),
    },
  }

  store.config = {
    general: {
      firstRun: true,
      tips: {
        scratchpad: true,
        conversation: false,
      }
    }
  }
})

test('isTipAvailable', () => {
  const { isTipAvailable } = useTipsManager(store)
  expect(isTipAvailable('scratchpad')).toBe(true)
  expect(isTipAvailable('conversation')).toBe(false)
})

test('setTipShown', () => {
  const { setTipShown } = useTipsManager(store)
  setTipShown('scratchpad')
  expect(store.config.general.tips.scratchpad).toBe(false)
})

test('showNextTip', () => {
  const { showNextTip } = useTipsManager(store)
  showNextTip()
  expect(store.config.general.firstRun).toBe(false)
  expect(store.config.general.tips.scratchpad).toBe(true)
  expect(store.config.general.tips.conversation).toBe(false)
  showNextTip()
  expect(store.config.general.tips.scratchpad).toBe(false)
  expect(store.config.general.tips.conversation).toBe(false)
})
