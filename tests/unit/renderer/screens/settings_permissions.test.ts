
import { vi, beforeAll, beforeEach, afterAll, expect, test, describe } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import { tabs, switchToTab } from './settings_utils'
import Settings from '@screens/Settings.vue'

enableAutoUnmount(afterAll)

vi.mock('@services/store.ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    store: {
      ...mod.store,
      saveSettings: vi.fn()
    }
  }
})

vi.mock('@renderer/composables/appearance_theme.ts', async () => {
  return { default: () => ({
    getTheme: () => store.config.appearance.theme === 'system' ? 'light' : store.config.appearance.theme
  })}
})

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.load = () => {}
  store.isFeatureEnabled = (feature: string) => feature !== 'workspaces'
  window.api.config.localeLLM = () => store.config.llm.locale || 'en-US'
  wrapper = mount(Settings)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Settings Permissions on macOS', () => {

  test('Shows permissions section on macOS', async () => {
    const tab = await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    expect(tab.find('.form-field.permissions').exists()).toBe(true)
    expect(tab.find('.form-field.permissions-info').exists()).toBe(true)
  })

  test('Shows granted status when permissions are granted', async () => {
    window.api.permissions.checkAccessibility = vi.fn(() => Promise.resolve(true))
    window.api.permissions.checkAutomation = vi.fn(() => Promise.resolve(true))

    const tab = await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })
    advancedComponent.vm.onShow()
    await wrapper.vm.$nextTick()

    const permissionFields = tab.findAll('.form-field.permissions')
    expect(permissionFields[0].find('.granted').exists()).toBe(true)
    expect(permissionFields[1].find('.granted').exists()).toBe(true)
    expect(permissionFields[0].find('.grant-btn').exists()).toBe(false)
    expect(permissionFields[1].find('.grant-btn').exists()).toBe(false)
  })

  test('Shows grant button when permissions are denied', async () => {
    window.api.permissions.checkAccessibility = vi.fn(() => Promise.resolve(false))
    window.api.permissions.checkAutomation = vi.fn(() => Promise.resolve(false))

    const tab = await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })
    advancedComponent.vm.onShow()
    await wrapper.vm.$nextTick()

    const permissionFields = tab.findAll('.form-field.permissions')
    expect(permissionFields[0].find('.granted').exists()).toBe(false)
    expect(permissionFields[1].find('.granted').exists()).toBe(false)
    expect(permissionFields[0].find('.grant-btn').exists()).toBe(true)
    expect(permissionFields[1].find('.grant-btn').exists()).toBe(true)
  })

  test('Grant button opens accessibility settings', async () => {
    window.api.permissions.checkAccessibility = vi.fn(() => Promise.resolve(false))
    window.api.permissions.checkAutomation = vi.fn(() => Promise.resolve(true))

    const tab = await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })
    advancedComponent.vm.onShow()
    await wrapper.vm.$nextTick()

    const permissionFields = tab.findAll('.form-field.permissions')
    await permissionFields[0].find('.grant-btn').trigger('click')

    expect(window.api.permissions.openAccessibilitySettings).toHaveBeenCalled()
  })

  test('Grant button opens automation settings', async () => {
    window.api.permissions.checkAccessibility = vi.fn(() => Promise.resolve(true))
    window.api.permissions.checkAutomation = vi.fn(() => Promise.resolve(false))

    const tab = await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })
    advancedComponent.vm.onShow()
    await wrapper.vm.$nextTick()

    const permissionFields = tab.findAll('.form-field.permissions')
    await permissionFields[1].find('.grant-btn').trigger('click')

    expect(window.api.permissions.openAutomationSettings).toHaveBeenCalled()
  })

})

describe('Settings show/hide mechanism', () => {

  test('Settings exposes onShow and onHide', () => {
    expect(wrapper.vm.onShow).toBeDefined()
    expect(wrapper.vm.onHide).toBeDefined()
  })

  test('SettingsAdvanced exposes load, onShow and onHide', () => {
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })
    expect(advancedComponent.vm.load).toBeDefined()
    expect(advancedComponent.vm.onShow).toBeDefined()
    expect(advancedComponent.vm.onHide).toBeDefined()
  })

})

describe('Settings Advanced permission polling', () => {

  test('onShow checks permissions immediately', async () => {
    await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })

    // Stop existing polling
    advancedComponent.vm.onHide()
    vi.clearAllMocks()

    // Call onShow
    advancedComponent.vm.onShow()

    // checkPermissions is called immediately (async)
    await wrapper.vm.$nextTick()
    expect(window.api.permissions.checkAccessibility).toHaveBeenCalled()
    expect(window.api.permissions.checkAutomation).toHaveBeenCalled()

    // Cleanup
    advancedComponent.vm.onHide()
  })

  test('onHide can be called safely multiple times', async () => {
    await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })

    // Call onHide multiple times - should not throw
    advancedComponent.vm.onHide()
    advancedComponent.vm.onHide()
    advancedComponent.vm.onHide()

    // Should be fine
    expect(true).toBe(true)
  })

  test('onShow after onHide starts fresh polling', async () => {
    await switchToTab(wrapper, tabs.indexOf('settingsAdvanced'))
    const advancedComponent = wrapper.getComponent({ ref: 'settingsAdvanced' })

    // Hide then show
    advancedComponent.vm.onHide()
    vi.clearAllMocks()

    advancedComponent.vm.onShow()
    await wrapper.vm.$nextTick()

    // Should check permissions again
    expect(window.api.permissions.checkAccessibility).toHaveBeenCalled()

    // Cleanup
    advancedComponent.vm.onHide()
  })

})
