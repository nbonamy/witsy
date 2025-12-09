import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import Settings from '@screens/Settings.vue'
import { store } from '@services/store'
import { useWindowMock } from '@tests/mocks/window'
import { switchToTab, tabs } from '../screens/settings_utils'

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

  // Initialize favorites
  store.config.llm.favorites = []

  wrapper = mount(Settings)
})

beforeEach(async () => {
  vi.clearAllMocks()
  store.config.llm.favorites = []

  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()
})

test('Settings Favorites shows empty state when no favorites', async () => {
  const tab = await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))

  expect(store.config.llm.favorites).toHaveLength(0)
  expect(tab.find('.empty-state').exists()).toBe(true)
  expect(tab.find('.empty-message').text()).toBeTruthy()
  expect(tab.find('table').exists()).toBe(false)
})

test('Settings Favorites displays table when favorites exist', async () => {
  // Add some favorites
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
    { id: 'openai-gpt-4', engine: 'openai', model: 'gpt-4' },
  ]

  const tab = await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  expect(tab.find('.empty-state').exists()).toBe(false)
  expect(tab.find('table').exists()).toBe(true)
  expect(tab.findAll('tbody tr')).toHaveLength(2)
})

test('Settings Favorites can add a favorite', async () => {
  await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })

  // Call showAddFavoriteModal directly
  settingsComponent.vm.showAddFavoriteModal()
  await wrapper.vm.$nextTick()

  // Select a model
  settingsComponent.vm.onModelSelectedForAdd('anthropic', 'claude-3-5-sonnet')
  await wrapper.vm.$nextTick()

  // Call onAddFavorite directly
  settingsComponent.vm.onAddFavorite()
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites).toHaveLength(1)
  expect(store.config.llm.favorites[0].engine).toBe('anthropic')
  expect(store.config.llm.favorites[0].model).toBe('claude-3-5-sonnet')
})

test('Settings Favorites can remove a favorite', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
  ]

  await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites).toHaveLength(1)

  // Call removeFavorite directly
  settingsComponent.vm.removeFavorite(0)
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites).toHaveLength(0)
})

test('Settings Favorites can move favorite up', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
    { id: 'openai-gpt-4', engine: 'openai', model: 'gpt-4' },
  ]

  await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites[0].model).toBe('claude-3-5-sonnet')
  expect(store.config.llm.favorites[1].model).toBe('gpt-4')

  // Call moveUp on second item
  settingsComponent.vm.moveUp(1)
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites[0].model).toBe('gpt-4')
  expect(store.config.llm.favorites[1].model).toBe('claude-3-5-sonnet')
})

test('Settings Favorites can move favorite down', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
    { id: 'openai-gpt-4', engine: 'openai', model: 'gpt-4' },
  ]

  await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites[0].model).toBe('claude-3-5-sonnet')
  expect(store.config.llm.favorites[1].model).toBe('gpt-4')

  // Call moveDown on first item
  settingsComponent.vm.moveDown(0)
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites[0].model).toBe('gpt-4')
  expect(store.config.llm.favorites[1].model).toBe('claude-3-5-sonnet')
})

test('Settings Favorites disables move up button on first item', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
    { id: 'openai-gpt-4', engine: 'openai', model: 'gpt-4' },
  ]

  const tab = await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  const rows = tab.findAll('tbody tr')
  const firstRowButtons = rows[0].findAllComponents({ name: 'ButtonIcon' })

  // Second button should be move up (disabled on first item)
  expect(firstRowButtons[1].attributes('disabled')).toBe('')
})

test('Settings Favorites disables move down button on last item', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
    { id: 'openai-gpt-4', engine: 'openai', model: 'gpt-4' },
  ]

  const tab = await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  const rows = tab.findAll('tbody tr')
  const lastRowButtons = rows[1].findAllComponents({ name: 'ButtonIcon' })

  // First button should be move down (disabled on last item)
  expect(lastRowButtons[0].attributes('disabled')).toBe('')
})

test('Settings Favorites does not add duplicate favorites', async () => {
  store.config.llm.favorites = [
    { id: 'anthropic-claude-3-5-sonnet', engine: 'anthropic', model: 'claude-3-5-sonnet' },
  ]

  await switchToTab(wrapper, tabs.indexOf('settingsFavorites'))
  const settingsComponent = wrapper.getComponent({ ref: 'settingsFavorites' })
  settingsComponent.vm.load()
  await wrapper.vm.$nextTick()

  expect(store.config.llm.favorites).toHaveLength(1)

  // Try to add same favorite again
  settingsComponent.vm.onModelSelectedForAdd('anthropic', 'claude-3-5-sonnet')
  await wrapper.vm.$nextTick()

  settingsComponent.vm.onAddFavorite()
  await wrapper.vm.$nextTick()

  // Should still have only 1 favorite
  expect(store.config.llm.favorites).toHaveLength(1)
})
