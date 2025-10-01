
import { beforeAll, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import SidebarFeatures from '../../src/components/SidebarFeatures.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  // Setup workspace with empty hiddenFeatures
  store.workspace = {
    uuid: 'test-workspace',
    name: 'Test Workspace',
    hiddenFeatures: []
  } as any

  wrapper = mount(SidebarFeatures)
})

test('Renders all 5 features', () => {
  expect(wrapper.exists()).toBe(true)

  const checkboxes = wrapper.findAll('input[type="checkbox"]')
  expect(checkboxes).toHaveLength(5)

  // Check that all features are present
  expect(wrapper.html()).toContain('designStudio.title')
  expect(wrapper.html()).toContain('scratchpad.title')
  expect(wrapper.html()).toContain('transcribe.title')
  expect(wrapper.html()).toContain('realtimeChat.title')
  expect(wrapper.html()).toContain('computerUse.title')
})

test('All checkboxes are checked by default (no hidden features)', () => {
  const checkboxes = wrapper.findAll('input[type="checkbox"]')

  checkboxes.forEach(checkbox => {
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })
})

test('Reflects hidden features in checkboxes', async () => {
  store.workspace.hiddenFeatures = ['studio', 'scratchpad']

  wrapper = mount(SidebarFeatures)
  await nextTick()

  const studioCheckbox = wrapper.find('#feature-studio')
  const scratchpadCheckbox = wrapper.find('#feature-scratchpad')
  const dictationCheckbox = wrapper.find('#feature-dictation')

  expect((studioCheckbox.element as HTMLInputElement).checked).toBe(false)
  expect((scratchpadCheckbox.element as HTMLInputElement).checked).toBe(false)
  expect((dictationCheckbox.element as HTMLInputElement).checked).toBe(true)
})

test('Toggling checkbox hides feature', async () => {
  const studioCheckbox = wrapper.find('#feature-studio')

  expect(store.workspace.hiddenFeatures).toEqual([])

  await studioCheckbox.trigger('change')
  await nextTick()

  expect(store.workspace.hiddenFeatures).toContain('studio')
})

test('Toggling checkbox shows hidden feature', async () => {
  store.workspace.hiddenFeatures = ['voiceMode']
  wrapper = mount(SidebarFeatures)
  await nextTick()

  const voiceModeCheckbox = wrapper.find('#feature-voiceMode')
  expect((voiceModeCheckbox.element as HTMLInputElement).checked).toBe(false)

  await voiceModeCheckbox.trigger('change')
  await nextTick()

  expect(store.workspace.hiddenFeatures).not.toContain('voiceMode')
})

test('Emits save event on toggle', async () => {
  const studioCheckbox = wrapper.find('#feature-studio')

  await studioCheckbox.trigger('change')

  expect(wrapper.emitted().save).toBeTruthy()
  expect(wrapper.emitted().save).toHaveLength(1)
})

test('Handles multiple toggles correctly', async () => {
  const studioCheckbox = wrapper.find('#feature-studio')
  const scratchpadCheckbox = wrapper.find('#feature-scratchpad')

  // Hide studio
  await studioCheckbox.trigger('change')
  await nextTick()
  expect(store.workspace.hiddenFeatures).toEqual(['studio'])

  // Hide scratchpad
  await scratchpadCheckbox.trigger('change')
  await nextTick()
  expect(store.workspace.hiddenFeatures).toEqual(['studio', 'scratchpad'])

  // Show studio again
  await studioCheckbox.trigger('change')
  await nextTick()
  expect(store.workspace.hiddenFeatures).toEqual(['scratchpad'])

  expect(wrapper.emitted().save).toHaveLength(3)
})
