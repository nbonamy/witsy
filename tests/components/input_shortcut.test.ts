
import { vi, beforeAll, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import InputShortcut from '../../src/components/InputShortcut.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

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

test('Input value', async () => {
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('⌃Space')
  await wrapper.find('input').trigger('keydown', { code: 'Enter', key: 'Enter', keyCode: 13, shiftKey: true, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('⌃⇧Enter')
})

test('Delete value with backspace', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Backspace', key: 'Backspace', keyCode: 8 })
  expect(wrapper.find('input').element.value).toBe('')
  expect(wrapper.emitted().change).toBeTruthy()
})

test('Delete value with icon', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).not.toBe('')
  await wrapper.find('.clear').trigger('click')
  expect(wrapper.find('input').element.value).toBe('')
  expect(wrapper.vm.value).toStrictEqual({ key: 'none' })
  expect(wrapper.emitted().change).toBeTruthy()
})

test('Invalid shortcuts', async () => {
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 32 })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Space', key: ' ', keyCode: 17, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
  await wrapper.find('input').trigger('keydown', { code: 'Shift', key: ' ', keyCode: 32, ctrlKey: true })
  expect(wrapper.find('input').element.value).toBe('')
})
