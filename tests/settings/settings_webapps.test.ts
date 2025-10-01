
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import SettingsWebApps from '../../src/settings/SettingsWebApps.vue'
import Dialog from '../../src/composables/dialog'

beforeAll(() => {
  useWindowMock()
  store.load()
  store.isFeatureEnabled = () => true

  if (!store.workspace) {
    store.workspace = {
      uuid: 'test-workspace',
      name: 'Test Workspace'
    }
  }
})

beforeEach(() => {
  store.workspace.webapps = []
  store.config.general.webappEvictionMinutes = 30
})

test('SettingsWebApps renders with sliding panes', () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  expect(wrapper.find('.sliding-root').exists()).toBe(true)
  expect(wrapper.find('.sliding-pane').exists()).toBe(true)
  expect(wrapper.find('.sliding-root').classes()).toContain('visible')
  expect(wrapper.find('.sliding-pane').classes()).not.toContain('visible')
})

test('SettingsWebApps shows editor when creating', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  // Click new - need to find it in the list component
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  // Editor should slide in
  expect(wrapper.find('.sliding-root').classes()).not.toContain('visible')
  expect(wrapper.find('.sliding-pane').classes()).toContain('visible')
})

test('SettingsWebApps cancels edit with escape key', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Open editor
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  expect(wrapper.find('.sliding-pane').classes()).toContain('visible')

  // Press escape
  await wrapper.trigger('keyup.escape')
  await nextTick()

  expect(wrapper.find('.sliding-pane').classes()).not.toContain('visible')
})

test('SettingsWebApps saves new webapp', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Open editor
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  // Fill form
  const nameInput = wrapper.find('.editor input[name="name"]')
  const urlInput = wrapper.find('.editor input[name="url"]')

  await nameInput.setValue('ChatGPT')
  await urlInput.setValue('https://chatgpt.com')
  await nextTick()

  // Save
  const saveButton = wrapper.find('.editor button.default')
  await saveButton.trigger('click')
  await nextTick()

  // Should be saved
  expect(store.workspace.webapps.length).toBe(1)
  expect(store.workspace.webapps[0].name).toBe('ChatGPT')
  expect(store.workspace.webapps[0].url).toBe('https://chatgpt.com')
  expect(window.api.workspace.save).toHaveBeenCalled()
})

test('SettingsWebApps updates existing webapp', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  // Double click to edit
  const row = wrapper.find('tbody tr')
  await row.trigger('dblclick')
  await nextTick()

  // Change name
  const nameInput = wrapper.find('.editor input[name="name"]')
  await nameInput.setValue('Test 1 Updated')
  await nextTick()

  // Save
  const saveButton = wrapper.find('.editor button.default')
  await saveButton.trigger('click')
  await nextTick()

  expect(store.workspace.webapps[0].name).toBe('Test 1 Updated')
})

test('SettingsWebApps header shows webapp name when editing', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test App', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  // Edit
  const row = wrapper.find('tbody tr')
  await row.trigger('dblclick')
  await nextTick()

  // Header should show webapp name
  const header = wrapper.find('header .title')
  expect(header.text()).toContain('Test App')
})

test('SettingsWebApps validates required fields', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Spy on Dialog.alert
  const alertSpy = vi.spyOn(Dialog, 'alert')

  // Open editor
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  // Try to save without filling form
  const saveButton = wrapper.find('.editor button.default')
  await saveButton.trigger('click')
  await nextTick()

  // Should show validation error
  expect(alertSpy).toHaveBeenCalled()
  expect(store.workspace.webapps.length).toBe(0)
})

test('SettingsWebApps exposes load method', () => {
  const wrapper = mount(SettingsWebApps)
  expect(wrapper.vm.load).toBeDefined()
  expect(typeof wrapper.vm.load).toBe('function')
})
