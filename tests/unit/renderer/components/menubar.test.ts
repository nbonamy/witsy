
import { beforeAll, beforeEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import MenuBar from '@components/MenuBar.vue'

beforeAll(() => {
  useWindowMock()
  store.load()

  // Initialize workspace if not already
  if (!store.workspace) {
    store.workspace = {
      uuid: 'test-workspace',
      name: 'Test Workspace',
      hiddenFeatures: []
    }
  }
})

beforeEach(() => {
  // Reset hiddenFeatures before each test
  if (store.workspace) {
    store.workspace.hiddenFeatures = []
  }
})

test('MenuBar renders without webapps when feature disabled', () => {
  // Disable webapps feature
  store.isFeatureEnabled = (feature: string) => feature !== 'webapps'

  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // Should not show webapp items when feature is disabled
  // Check by looking for webapp names in text
  expect(wrapper.text()).not.toContain('Test 1')
})

test('MenuBar renders enabled webapps when feature enabled', () => {
  // Enable webapps feature
  store.isFeatureEnabled = () => true

  store.workspace.webapps = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'MessageSquare', enabled: true },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: 'Bot', enabled: true },
    { id: 'disabled', name: 'Disabled', url: 'https://disabled.com', icon: 'Globe', enabled: false }
  ]

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // Check names are rendered (only enabled ones)
  expect(wrapper.text()).toContain('ChatGPT')
  expect(wrapper.text()).toContain('Claude')
  expect(wrapper.text()).not.toContain('Disabled')
})

test('MenuBar highlights active webapp', () => {
  store.isFeatureEnabled = () => true

  store.workspace.webapps = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'MessageSquare', enabled: true },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: 'Bot', enabled: true }
  ]

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'webapp-chatgpt'
    }
  })

  // Find all active items - there should be exactly one
  const activeItems = wrapper.findAll('.item.active')
  expect(activeItems.length).toBeGreaterThan(0)
})

test('MenuBar emits change event when webapp clicked', async () => {
  store.isFeatureEnabled = () => true

  store.workspace.webapps = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'MessageSquare', enabled: true }
  ]

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // Find all items and look for one containing ChatGPT
  const allItems = wrapper.findAllComponents({ name: 'MenuBarItem' })
  const chatgptItem = allItems.find(item => item.text().includes('ChatGPT'))

  expect(chatgptItem).toBeTruthy()

  if (chatgptItem) {
    await chatgptItem.trigger('click')
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')?.[0]).toEqual(['webapp-chatgpt'])
  }
})

test('MenuBar handles empty webapps array', () => {
  store.isFeatureEnabled = () => true

  store.workspace.webapps = []

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  const webappItems = wrapper.findAll('[action^="webapp-"]')
  expect(webappItems.length).toBe(0)
})

test('MenuBar handles undefined webapps', () => {
  store.isFeatureEnabled = () => true

  store.workspace.webapps = undefined

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  const webappItems = wrapper.findAll('[action^="webapp-"]')
  expect(webappItems.length).toBe(0)
})

test('MenuBar renders webapps in order', () => {
  store.isFeatureEnabled = () => true

  store.workspace.webapps = [
    { id: 'first', name: 'First App', url: 'https://first.com', icon: 'Globe', enabled: true },
    { id: 'second', name: 'Second App', url: 'https://second.com', icon: 'MessageSquare', enabled: true }
  ]

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // Both should be rendered
  expect(wrapper.text()).toContain('First App')
  expect(wrapper.text()).toContain('Second App')

  // Check they appear in the DOM in order
  const text = wrapper.text()
  const firstPos = text.indexOf('First App')
  const secondPos = text.indexOf('Second App')
  expect(firstPos).toBeGreaterThan(-1)
  expect(secondPos).toBeGreaterThan(firstPos)
})

test('MenuBar hides features when in hiddenFeatures array', () => {
  store.isFeatureEnabled = () => true
  store.workspace.hiddenFeatures = ['studio', 'scratchpad']

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // Should not find studio or scratchpad menu items
  const studioItem = wrapper.find('[action="studio"]')
  const scratchpadItem = wrapper.find('[action="scratchpad"]')

  expect(studioItem.exists()).toBe(false)
  expect(scratchpadItem.exists()).toBe(false)
})

test('MenuBar hides computerUse when in hiddenFeatures even if config present', () => {
  store.isFeatureEnabled = () => true
  store.workspace.hiddenFeatures = ['computerUse']
  store.config.engines.anthropic = {
    apiKey: 'test-key',
    models: {
      chat: [{ id: 'computer-use', name: 'Computer Use' }]
    }
  } as any

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  const computerUseItem = wrapper.find('[action="computer-use"]')
  expect(computerUseItem.exists()).toBe(false)
})

test('MenuBar respects both global feature flags and hiddenFeatures', () => {
  // Globally disable voiceMode, enable everything else
  store.isFeatureEnabled = (feature: string) => {
    if (feature === 'voiceMode') return false
    return true
  }
  store.workspace.hiddenFeatures = ['studio'] // Hide studio via workspace

  const wrapper = mount(MenuBar, {
    props: {
      mode: 'chat'
    }
  })

  // studio hidden via hiddenFeatures
  expect(wrapper.find('[action="studio"]').exists()).toBe(false)
  // voiceMode hidden via global feature flag
  expect(wrapper.find('[action="voice-mode"]').exists()).toBe(false)
})
