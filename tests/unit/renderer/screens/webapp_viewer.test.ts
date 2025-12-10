
import { beforeAll, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import WebAppViewer from '@screens/WebAppViewer.vue'
import { WebApp } from '@/types/workspace'

beforeAll(() => {
  useWindowMock()
})

test('WebAppViewer renders with correct structure', () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  expect(wrapper.find('.webapp-viewer').exists()).toBe(true)
  const webview = wrapper.find('webview')
  expect(webview.exists()).toBe(true)
  expect(webview.attributes('data-webapp-id')).toBe('test-app')
  expect(webview.attributes('partition')).toBe('persist:webapp_Test App')
  expect(webview.attributes('allowpopups')).toBeDefined()
})

test('WebAppViewer hides when visible prop is false', () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: false
    }
  })

  // v-show makes element not visible but still in DOM
  const container = wrapper.find('.webapp-viewer')
  expect(container.exists()).toBe(true)
  expect(container.element.style.display).toBe('none')
})

test('WebAppViewer shows when visible prop is true', () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  const container = wrapper.find('.webapp-viewer')
  expect(container.element.style.display).not.toBe('none')
})

test('WebAppViewer emits update-last-used when becoming visible', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: false
    }
  })

  expect(wrapper.emitted('update-last-used')).toBeUndefined()

  // Change to visible
  await wrapper.setProps({ visible: true })
  await nextTick()

  expect(wrapper.emitted('update-last-used')).toBeTruthy()
  expect(wrapper.emitted('update-last-used')?.length).toBe(1)
})

test('WebAppViewer does not emit update-last-used when already visible', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  // Get current emission count
  const initialCount = wrapper.emitted('update-last-used')?.length || 0

  // Set visible to true again (no change)
  await wrapper.setProps({ visible: true })
  await nextTick()

  // Should not emit again - count should be the same
  const finalCount = wrapper.emitted('update-last-used')?.length || 0
  expect(finalCount).toBe(initialCount)
})

test('WebAppViewer emits update-last-used on each show', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: false
    }
  })

  // Show first time
  await wrapper.setProps({ visible: true })
  await nextTick()
  expect(wrapper.emitted('update-last-used')?.length).toBe(1)

  // Hide
  await wrapper.setProps({ visible: false })
  await nextTick()

  // Show again
  await wrapper.setProps({ visible: true })
  await nextTick()
  expect(wrapper.emitted('update-last-used')?.length).toBe(2)
})

test('WebAppViewer passes correct webapp data', () => {
  const webapp: WebApp = {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    icon: 'MessageSquare',
    enabled: true,
    lastUsed: Date.now()
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  const webview = wrapper.find('webview')
  expect(webview.attributes('data-webapp-id')).toBe('chatgpt')
})

test('WebAppViewer shows toolbar when visible and not loading', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  // Mock webview navigation methods
  const webview = wrapper.find('webview').element as any
  webview.canGoBack = () => false
  webview.canGoForward = () => false

  // Simulate webview loading completion
  webview.dispatchEvent(new Event('did-finish-load'))
  await nextTick()

  const toolbar = wrapper.find('.webapp-toolbar')
  expect(toolbar.exists()).toBe(true)
})

test('WebAppViewer hides toolbar while loading', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: false
    }
  })

  // Switch to visible to trigger loading
  await wrapper.setProps({ visible: true })
  await nextTick()

  // Toolbar should not be visible while loading
  const toolbar = wrapper.find('.webapp-toolbar')
  expect(toolbar.exists()).toBe(false)

  // Loading indicator should be present
  const loading = wrapper.find('.loading')
  expect(loading.exists()).toBe(true)
})

test('WebAppViewer toolbar has all navigation buttons', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  // Mock webview navigation methods
  const webview = wrapper.find('webview').element as any
  webview.canGoBack = () => false
  webview.canGoForward = () => false

  // Simulate webview loading completion
  webview.dispatchEvent(new Event('did-finish-load'))
  await nextTick()

  const buttons = wrapper.findAllComponents({ name: 'ButtonIcon' })
  expect(buttons.length).toBe(4) // home, back, forward, reload
})

test('WebAppViewer back and forward buttons start disabled', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  // Mock webview navigation methods
  const webview = wrapper.find('webview').element as any
  webview.canGoBack = () => false
  webview.canGoForward = () => false

  // Simulate webview loading completion
  webview.dispatchEvent(new Event('did-finish-load'))
  await nextTick()

  const buttons = wrapper.findAllComponents({ name: 'ButtonIcon' })
  // buttons[1] is back, buttons[2] is forward
  expect(buttons[1].attributes('disabled')).toBeDefined()
  expect(buttons[2].attributes('disabled')).toBeDefined()
})

test('WebAppViewer home and reload buttons are never disabled', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    enabled: true
  }

  const wrapper = mount(WebAppViewer, {
    props: {
      webapp,
      visible: true
    }
  })

  // Mock webview navigation methods
  const webview = wrapper.find('webview').element as any
  webview.canGoBack = () => false
  webview.canGoForward = () => false

  // Simulate webview loading completion
  webview.dispatchEvent(new Event('did-finish-load'))
  await nextTick()

  const buttons = wrapper.findAllComponents({ name: 'ButtonIcon' })
  // buttons[0] is home, buttons[3] is reload
  expect(buttons[0].attributes('disabled')).toBeUndefined()
  expect(buttons[3].attributes('disabled')).toBeUndefined()
})
