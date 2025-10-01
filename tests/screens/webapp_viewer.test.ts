
import { beforeAll, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import WebAppViewer from '../../src/screens/WebAppViewer.vue'
import { WebApp } from '../../src/types/workspace'

beforeAll(() => {
  useWindowMock()
})

test('WebAppViewer renders with correct structure', () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    icon: 'Globe',
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
  expect(webview.attributes('partition')).toBe('persist:webview')
  expect(webview.attributes('allowpopups')).toBeDefined()
})

test('WebAppViewer hides when visible prop is false', () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    icon: 'Globe',
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
    icon: 'Globe',
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
    icon: 'Globe',
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
    icon: 'Globe',
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
    icon: 'Globe',
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
