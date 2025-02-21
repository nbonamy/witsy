
import { vi, beforeAll, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import InputObfuscated from '../../src/components/InputObfuscated.vue'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  wrapper = mount(InputObfuscated, {
    props: {
      onChange: vi.fn(),
    }
  })
})

test('Create', async () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('input').exists()).toBe(true)
  expect(wrapper.find('input').attributes().type).toBe('password')
  expect(wrapper.find('.icon').exists()).toBe(true)
})

test('Toggle type', async () => {
  await wrapper.find('.icon').trigger('click')
  expect(wrapper.find('input').attributes().type).toBe('text')
  await wrapper.find('.icon').trigger('click')
  expect(wrapper.find('input').attributes().type).toBe('password')
})

test('Emits events', async () => {
  await wrapper.find('input').trigger('keyup', { key: 'p' })
  expect(wrapper.emitted().change).toBeTruthy()

  await wrapper.find('input').trigger('blur')
  expect(wrapper.emitted().blur).toBeTruthy()
})
