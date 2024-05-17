
import { vi, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import InputShortcut from '../../src/components/InputShortcut.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

window.api = {
  platform: 'darwin',
  shortcuts: {
    register: vi.fn(),
    unregister: vi.fn(),
  }
}

beforeEach(() => {
  wrapper = mount(InputShortcut, {
    props: {
      onChange: vi.fn(),
    }
  })
})

test('Create', async () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('input').exists()).toBe(true)
})

test('Focus', async () => {
  await wrapper.find('input').trigger('focus')
  expect(window.api.shortcuts.unregister).toHaveBeenCalled()
})

test('Blur', async () => {
  await wrapper.find('input').trigger('blur')
  expect(window.api.shortcuts.register).toHaveBeenCalled()
})

test('Input value', async () => {
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('⌃Space')
})

test('Delete value with backspace', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Backspace', key: 'Backspace', keyCode: 8 })
  expect(wrapper.find('input').element.value).toBe('')
})

test('Delete value with icon', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('.icon').trigger('click')
  expect(wrapper.find('input').element.value).toBe('')
})

test('Invalid shortcuts', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32 })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 14, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Shift', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
})
