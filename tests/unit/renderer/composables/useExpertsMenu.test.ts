import { vi, test, expect, describe, beforeAll, beforeEach } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { useExpertsMenu } from '@composables/useExpertsMenu'
import { store } from '@services/store'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  store.loadSettings()
  vi.clearAllMocks()
})

describe('useExpertsMenu', () => {

  const createTestExperts = () => {
    store.experts = [
      {
        id: 'expert-1',
        type: 'user',
        name: 'Expert One',
        prompt: 'Instructions 1',
        state: 'enabled',
        triggerApps: []
      },
      {
        id: 'expert-2',
        type: 'user',
        name: 'Expert Two',
        prompt: 'Instructions 2',
        state: 'enabled',
        triggerApps: []
      },
      {
        id: 'expert-disabled',
        type: 'user',
        name: 'Disabled Expert',
        prompt: 'Instructions',
        state: 'disabled',
        triggerApps: []
      }
    ]
    store.expertCategories = []
  }

  describe('footerItems', () => {

    test('returns empty array when footerMode is none', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit, footerMode: 'none' })

      expect(footerItems.value).toEqual([])
    })

    test('returns clear item when footerMode is clear', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit, footerMode: 'clear' })

      expect(footerItems.value).toHaveLength(1)
      expect(footerItems.value[0].id).toBe('experts-clear')
    })

    test('clear item emits expertSelected with null when clicked', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit, footerMode: 'clear' })

      footerItems.value[0].onClick!()

      expect(emit).toHaveBeenCalledWith('expertSelected', null)
    })

    test('returns manage item when footerMode is manage', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit, footerMode: 'manage' })

      expect(footerItems.value).toHaveLength(1)
      expect(footerItems.value[0].id).toBe('experts-manage')
    })

    test('manage item emits manageExperts when clicked', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit, footerMode: 'manage' })

      footerItems.value[0].onClick!()

      expect(emit).toHaveBeenCalledWith('manageExperts')
    })

    test('defaults to none when footerMode not specified', () => {
      createTestExperts()
      const emit = vi.fn()
      const { footerItems } = useExpertsMenu({ emit })

      expect(footerItems.value).toEqual([])
    })

  })

  describe('menuItems', () => {

    test('returns only enabled experts', () => {
      createTestExperts()
      const emit = vi.fn()
      const { menuItems } = useExpertsMenu({ emit })

      // Should have 2 enabled experts
      expect(menuItems.value).toHaveLength(2)
      expect(menuItems.value.find(item => item.id === 'expert-expert-disabled')).toBeUndefined()
    })

    test('clicking expert emits expertSelected with id', () => {
      createTestExperts()
      const emit = vi.fn()
      const { menuItems } = useExpertsMenu({ emit })

      const expertItem = menuItems.value.find(item => item.id === 'expert-expert-1')
      expertItem!.onClick!()

      expect(emit).toHaveBeenCalledWith('expertSelected', 'expert-1')
    })

  })

})
