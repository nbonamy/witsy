
import { beforeAll, beforeEach, test, expect, vi, describe } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/renderer/services/store'
import useTipsManager from '../../src/renderer/composables/tips_manager'
import Dialog from '../../src/renderer/composables/dialog'

// Mock dialog
vi.mock('../../src/renderer/composables/dialog', () => ({
  default: {
    show: vi.fn(() => Promise.resolve({ isConfirmed: true, value: true })),
  },
}))

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  store.loadSettings()
  store.config.general.tips.conversation = false
  vi.clearAllMocks()
})

describe('TipsManager', () => {

  describe('isTipAvailable', () => {
    test('returns true when tip is undefined', () => {
      const tipsManager = useTipsManager(store)
      delete store.config.general.tips.engineSelector
      expect(tipsManager.isTipAvailable('engineSelector')).toBe(true)
    })

    test('returns true when tip is true', () => {
      const tipsManager = useTipsManager(store)
      store.config.general.tips.engineSelector = true
      expect(tipsManager.isTipAvailable('engineSelector')).toBe(true)
    })

    test('returns false when tip is false', () => {
      const tipsManager = useTipsManager(store)
      expect(tipsManager.isTipAvailable('conversation')).toBe(false)
    })
  })

  describe('setTipShown', () => {
    test('sets tip to false and saves settings', () => {
      const tipsManager = useTipsManager(store)
      tipsManager.setTipShown('engineSelector')
      expect(store.config.general.tips.engineSelector).toBe(false)
    })
  })

  describe('showNextTip', () => {
    test('clears firstRun flag and returns', () => {
      const tipsManager = useTipsManager(store)
      store.config.general.firstRun = true

      tipsManager.showNextTip()

      expect(store.config.general.firstRun).toBe(false)
    })

    test('does nothing when not first run and no tips', () => {
      const tipsManager = useTipsManager(store)
      store.config.general.firstRun = false

      tipsManager.showNextTip()

      // No crash, just returns
      expect(store.config.general.firstRun).toBe(false)
    })
  })

  describe('showTip', () => {
    test('returns early when tip not available and not forced', async () => {
      const tipsManager = useTipsManager(store)
      store.config.general.tips.conversation = false

      await tipsManager.showTip('conversation')

      expect(Dialog.show).not.toHaveBeenCalled()
    })

    test('shows tip when forced even if not available', async () => {
      const tipsManager = useTipsManager(store)
      store.config.general.tips.conversation = false

      await tipsManager.showTip('conversation', true)

      expect(Dialog.show).toHaveBeenCalled()
    })
  })

  describe('tip handlers', () => {
    test('showConversationTip shows dialog', async () => {
      const tipsManager = useTipsManager(store)

      await tipsManager.showConversationTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.conversation.title',
      })
    })

    test('showComputerUseWarning shows dialog', async () => {
      const tipsManager = useTipsManager(store)

      await tipsManager.showComputerUseWarning()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.computerUse.title',
        text: 'tips.computerUse.text',
      })
    })

    test('showRealtimeTip shows dialog', async () => {
      const tipsManager = useTipsManager(store)

      await tipsManager.showRealtimeTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.realtime.title',
      })
    })

    test('showFolderListTip shows dialog', async () => {
      const tipsManager = useTipsManager(store)

      await tipsManager.showFolderListTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.folderList.title',
        text: 'tips.folderList.text',
      })
    })

    test('showFavoriteModelsTip shows dialog', async () => {
      const tipsManager = useTipsManager(store)

      await tipsManager.showFavoriteModelsTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.favoriteModels.title',
        text: 'tips.favoriteModels.text',
      })
    })

    test('showPluginsDisabledTip shows dialog with checkbox', async () => {
      const tipsManager = useTipsManager(store)
      vi.mocked(Dialog.show).mockResolvedValue({ value: true } as any)

      const result = await tipsManager.showPluginsDisabledTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.pluginsDisabled.title',
        text: 'tips.pluginsDisabled.text',
        input: 'checkbox',
        inputLabel: 'tips.doNotShowAgain',
      })
      expect(result).toBe(true)
    })

    test('showFolderDefaultsTip shows dialog with checkbox', async () => {
      const tipsManager = useTipsManager(store)
      vi.mocked(Dialog.show).mockResolvedValue({ value: false } as any)

      const result = await tipsManager.showFolderDefaultsTip()

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'tips.folderDefaults.title',
        text: 'tips.folderDefaults.text',
        input: 'checkbox',
        inputLabel: 'tips.doNotShowAgain',
      })
      expect(result).toBe(false)
    })
  })
})
