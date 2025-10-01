
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

test('SettingsWebApps renders empty state', () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Should show no apps message
  expect(wrapper.find('.no-webapps').exists()).toBe(true)

  // Should show eviction input
  const evictionInput = wrapper.find('input[type="number"]')
  expect(evictionInput.exists()).toBe(true)
  expect((evictionInput.element as HTMLInputElement).value).toBe('30')
})

test('SettingsWebApps loads webapps from workspace', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true },
    { id: 'test2', name: 'Test 2', url: 'https://test2.com', icon: 'MessageSquare', enabled: false }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  const rows = wrapper.findAll('tbody tr')
  expect(rows.length).toBe(2)

  // Check that table contains webapp data
  const tableCells = wrapper.findAll('tbody td')
  const cellTexts = tableCells.map(td => td.text())
  expect(cellTexts.join(' ')).toContain('Test 1')
  expect(cellTexts.join(' ')).toContain('Test 2')
  expect(cellTexts.join(' ')).toContain('https://test1.com')
  expect(cellTexts.join(' ')).toContain('https://test2.com')
})

test('SettingsWebApps can select webapp', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  const row = wrapper.find('tbody tr')
  await row.trigger('click')
  await nextTick()

  expect(row.classes()).toContain('selected')
})

test('SettingsWebApps opens editor on create', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  // Editor should be visible
  const editor = wrapper.find('.editor.sliding-pane')
  expect(editor.classes()).toContain('visible')

  // Should have empty form
  const nameInput = wrapper.find('.editor input[type="text"]')
  expect((nameInput.element as HTMLInputElement).value).toBe('')
})

test('SettingsWebApps creates new webapp with save button', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Click new
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  // Fill in form
  const inputs = wrapper.findAll('.editor input')
  const nameInput = inputs.find(i => i.attributes('type') === 'text')
  const urlInput = inputs.find(i => i.attributes('type') === 'url')

  await nameInput.setValue('ChatGPT')
  await urlInput.setValue('https://chatgpt.com')
  await nextTick()

  // Should NOT auto-save yet
  expect(store.workspace.webapps.length).toBe(0)

  // Click save
  const saveButton = wrapper.find('button.save')
  await saveButton.trigger('click')
  await nextTick()

  // Now should be saved
  expect(window.api.workspace.save).toHaveBeenCalled()
  expect(store.workspace.webapps.length).toBe(1)
  expect(store.workspace.webapps[0].name).toBe('ChatGPT')
  expect(store.workspace.webapps[0].url).toBe('https://chatgpt.com')
})

test('SettingsWebApps edits existing webapp', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  // Select and edit
  const row = wrapper.find('tbody tr')
  await row.trigger('dblclick')
  await nextTick()

  // Editor should be visible
  expect(wrapper.find('.editor.sliding-pane').classes()).toContain('visible')

  // Change name
  const nameInput = wrapper.find('.editor input[type="text"]')
  await nameInput.setValue('Test 1 Updated')
  await nextTick()

  // Should NOT auto-save
  expect(store.workspace.webapps[0].name).toBe('Test 1')

  // Click save
  const saveButton = wrapper.find('button.save')
  await saveButton.trigger('click')
  await nextTick()

  // Now should be updated
  expect(store.workspace.webapps[0].name).toBe('Test 1 Updated')
})

test('SettingsWebApps deletes webapp', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  // Select
  const row = wrapper.find('tbody tr')
  await row.trigger('click')
  await nextTick()

  // Mock dialog confirmation
  vi.spyOn(Dialog, 'show').mockResolvedValue({ isConfirmed: true } as any)

  // Delete
  const deleteButton = wrapper.find('.list-action.delete')
  await deleteButton.trigger('click')
  await flushPromises()

  expect(store.workspace.webapps.length).toBe(0)
  expect(window.api.workspace.save).toHaveBeenCalled()
})

test('SettingsWebApps toggles enabled state', async () => {
  store.workspace.webapps = [
    { id: 'test1', name: 'Test 1', url: 'https://test1.com', icon: 'Globe', enabled: true }
  ]

  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()
  await nextTick()

  const checkbox = wrapper.find('tbody tr input[type="checkbox"]')
  await checkbox.trigger('click')
  await nextTick()

  expect(store.workspace.webapps[0].enabled).toBe(false)
  expect(window.api.workspace.save).toHaveBeenCalled()
})

test('SettingsWebApps updates eviction duration', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  const evictionInput = wrapper.find('input[type="number"]')
  await evictionInput.setValue(60)
  await nextTick()

  expect(store.config.general.webappEvictionMinutes).toBe(60)
})

test('SettingsWebApps cancels edit', async () => {
  const wrapper = mount(SettingsWebApps)
  wrapper.vm.load()

  // Open editor
  const newButton = wrapper.find('.list-action.new')
  await newButton.trigger('click')
  await nextTick()

  expect(wrapper.find('.editor.sliding-pane').classes()).toContain('visible')

  // Cancel
  const cancelButton = wrapper.find('button.cancel')
  await cancelButton.trigger('click')
  await nextTick()

  expect(wrapper.find('.editor.sliding-pane').classes()).not.toContain('visible')
})
