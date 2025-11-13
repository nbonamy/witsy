
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import Main from '../../src/renderer/screens/Main.vue'

vi.unmock('../../src/renderer/composables/event_bus')
import useEventBus from '../../src/renderer/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Fullscreen image', async () => {
  const wrapper = mount(Main)
  emitEvent('fullscreen', 'https://example.com/image.jpg')
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.fullscreen').exists()).toBe(true)
  expect(window.api.app.fullscreen).toHaveBeenLastCalledWith('main', true)
  await wrapper.find('.fullscreen').trigger('click')
  expect(wrapper.find('.fullscreen').exists()).toBe(false)
  expect(window.api.app.fullscreen).toHaveBeenLastCalledWith('main', false)
})
