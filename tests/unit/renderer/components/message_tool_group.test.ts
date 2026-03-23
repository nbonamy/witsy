
import { vi, beforeAll, afterAll, expect, test, describe } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import MessageItemToolGroupBlock from '@components/MessageItemToolGroupBlock.vue'
import { nextTick } from 'vue'

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

const makeToolCalls = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `tool-${i + 1}`,
    function: `tool_${i + 1}`,
    done: true,
    args: { param: `value${i + 1}` },
    result: { output: `result${i + 1}` },
  }))
}

describe('MessageItemToolGroupBlock', () => {

  test('renders collapsed with count', async () => {
    const wrapper = mount(MessageItemToolGroupBlock, {
      props: { toolCalls: makeToolCalls(3) },
    })
    expect(wrapper.find('.tool-group-header').exists()).toBe(true)
    expect(wrapper.find('.tool-group-text').text()).toContain('3')
    expect(wrapper.findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  })

  test('renders singular count', async () => {
    const wrapper = mount(MessageItemToolGroupBlock, {
      props: { toolCalls: makeToolCalls(1) },
    })
    expect(wrapper.find('.tool-group-text').text()).toContain('1')
  })

  test('expands on click', async () => {
    const wrapper = mount(MessageItemToolGroupBlock, {
      props: { toolCalls: makeToolCalls(2) },
    })
    expect(wrapper.findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
    await wrapper.find('.tool-group-header').trigger('click')
    await nextTick()
    const toolBlocks = wrapper.findAllComponents({ name: 'MessageItemToolBlock' })
    expect(toolBlocks).toHaveLength(2)
  })

  test('collapses on second click', async () => {
    const wrapper = mount(MessageItemToolGroupBlock, {
      props: { toolCalls: makeToolCalls(2) },
    })
    await wrapper.find('.tool-group-header').trigger('click')
    await nextTick()
    expect(wrapper.findAllComponents({ name: 'MessageItemToolBlock' })).toHaveLength(2)
    await wrapper.find('.tool-group-header').trigger('click')
    await nextTick()
    expect(wrapper.findComponent({ name: 'MessageItemToolBlock' }).exists()).toBe(false)
  })

})
