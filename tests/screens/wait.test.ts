
import { beforeAll, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import Wait from '../../src/screens/Wait.vue'

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})


test('Renders correctly', () => {
  const wrapper = mount(Wait)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.wait').exists()).toBe(true)
  expect(wrapper.find('.loader').exists()).toBe(true)
  expect(wrapper.find('.cancel').exists()).toBe(true)
  expect(wrapper.find('.loader').isVisible()).toBe(true)
  expect(wrapper.find('.cancel').isVisible()).toBe(false)
})

test('Toggles cancel Button', async () => {
  const wrapper = mount(Wait)
  await wrapper.find('.wait').trigger('mouseenter')
  expect(wrapper.find('.loader').isVisible()).toBe(false)
  expect(wrapper.find('.cancel').isVisible()).toBe(true)
  await wrapper.find('.wait').trigger('mouseleave')
  expect(wrapper.find('.loader').isVisible()).toBe(true)
  expect(wrapper.find('.cancel').isVisible()).toBe(false)
})

test('Cancels command', () => {
  const wrapper = mount(Wait)
  wrapper.find('.cancel').trigger('click')
  expect(window.api.commands.closeResult).toHaveBeenCalled()
  expect(window.api.anywhere.close).toHaveBeenCalled()
})
