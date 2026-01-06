
import { vi, beforeAll, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import SettingsComputerUse from '@renderer/settings/SettingsComputerUse.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  store.config.computerUse = { provider: 'anthropic' }
  wrapper = mount(SettingsComputerUse)
  wrapper.vm.load()
})

test('Create', async () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('select').exists()).toBe(true)
})

test('Load default provider', async () => {
  expect(wrapper.find('select').element.value).toBe('anthropic')
})

test('Load google provider', async () => {
  store.config.computerUse.provider = 'google'
  wrapper.vm.load()
  await nextTick()
  expect(wrapper.find('select').element.value).toBe('google')
})

test('Change provider', async () => {
  vi.spyOn(store, 'saveSettings')
  await wrapper.find('select').setValue('google')
  expect(store.config.computerUse.provider).toBe('google')
  expect(store.saveSettings).toHaveBeenCalled()
})
