
import { beforeAll, beforeEach, test, expect } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import useTipsManager from '../../src/composables/tips_manager'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  store.loadSettings()
  store.config.general.tips.conversation = false
})

test('isTipAvailable', () => {
  const { isTipAvailable } = useTipsManager(store)
  expect(isTipAvailable('conversation')).toBe(false)
})

test('setTipShown', () => {
  const { setTipShown } = useTipsManager(store)
  setTipShown('engineSelector')
  expect(store.config.general.tips.engineSelector).toBe(false)
})

test('showNextTip', () => {
  const { showNextTip } = useTipsManager(store)
  showNextTip()
  expect(store.config.general.firstRun).toBe(false)
  showNextTip()
})
