
import { beforeAll, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import WebAppEditor from '../../src/components/WebAppEditor.vue'
import { WebApp } from '../../src/types/workspace'

beforeAll(() => {
  useWindowMock()
})

test('WebAppEditor renders with correct structure', () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  expect(wrapper.find('.webapp-editor').exists()).toBe(true)
  expect(wrapper.find('input[name="name"]').exists()).toBe(true)
  expect(wrapper.find('input[name="url"]').exists()).toBe(true)
})

test('WebAppEditor displays website favicon for valid URLs', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  const urlInput = wrapper.find('input[name="url"]')
  await urlInput.setValue('https://example.com')
  await nextTick()

  const favicon = wrapper.find('.favicon')
  expect(favicon.exists()).toBe(true)
  expect(favicon.attributes('src')).toContain('https://s2.googleusercontent.com/s2/favicons')
})

test('WebAppEditor does not display favicon for invalid URLs', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  const urlInput = wrapper.find('input[name="url"]')
  await urlInput.setValue('not-a-valid-url')
  await nextTick()

  const favicon = wrapper.find('.favicon')
  expect(favicon.exists()).toBe(false)

  const placeholder = wrapper.find('.placeholder-icon')
  expect(placeholder.exists()).toBe(true)
})

test('WebAppEditor validates URL with regex before showing favicon', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  const urlInput = wrapper.find('input[name="url"]')

  // Test invalid URLs
  const invalidUrls = [
    'example.com',
    'ftp://example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    ''
  ]

  for (const url of invalidUrls) {
    await urlInput.setValue(url)
    await nextTick()
    expect(wrapper.find('.favicon').exists()).toBe(false)
  }

  // Test valid URLs
  const validUrls = [
    'https://example.com',
    'http://example.com',
    'https://www.example.com',
    'https://subdomain.example.com',
    'https://example.com/path',
    'https://example.com/path?query=value',
    'https://example.com:8080'
  ]

  for (const url of validUrls) {
    await urlInput.setValue(url)
    await nextTick()
    expect(wrapper.find('.favicon').exists()).toBe(true)
  }
})

test('WebAppEditor emits webapp-modified with correct data on save', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  await wrapper.find('input[name="name"]').setValue('Test App')
  await wrapper.find('input[name="url"]').setValue('https://example.com')
  await nextTick()

  const saveButton = wrapper.findAll('button').find(btn => btn.text().includes('common.save'))
  await saveButton?.trigger('click')

  expect(wrapper.emitted('webapp-modified')).toBeTruthy()
  const emitted = wrapper.emitted('webapp-modified')?.[0]?.[0] as WebApp
  expect(emitted.name).toBe('Test App')
  expect(emitted.url).toBe('https://example.com')
  expect(emitted.enabled).toBe(true)
})

test('WebAppEditor allows using website icon', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  await wrapper.find('input[name="url"]').setValue('https://example.com')
  await nextTick()

  const websiteIconOption = wrapper.findAll('.icon-option')[0]
  await websiteIconOption.trigger('click')

  expect(websiteIconOption.classes()).toContain('active')
})

test('WebAppEditor populates fields from existing webapp', async () => {
  const webapp: WebApp = {
    id: 'test-app',
    name: 'Test App',
    url: 'https://example.com',
    icon: 'Globe',
    enabled: false
  }

  const wrapper = mount(WebAppEditor, {
    props: {
      webapp
    }
  })

  await nextTick()

  expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('Test App')
  expect((wrapper.find('input[name="url"]').element as HTMLInputElement).value).toBe('https://example.com')
  expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
})

test('WebAppEditor emits null on cancel', async () => {
  const wrapper = mount(WebAppEditor, {
    props: {
      webapp: null
    }
  })

  const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('common.cancel'))
  await cancelButton?.trigger('click')

  expect(wrapper.emitted('webapp-modified')).toBeTruthy()
  expect(wrapper.emitted('webapp-modified')?.[0]?.[0]).toBe(null)
})
