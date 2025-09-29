
import { vi, beforeAll, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/services/store'
import MessageItemToolBlock from '../../src/components/MessageItemToolBlock.vue'
import { beforeEach } from 'node:test'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  window.sessionStorage.clear()
  vi.clearAllTimers()
})

test('Basic rendering of done', async () => {
  
  const wrapper = mount(MessageItemToolBlock, { props: { toolCall: {
    id: 'tool1',
    name: 'tool1',
    status: undefined,
    done: true,
    params: { key: 'value' },
    result: { result: 'result' },
  }}})

  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-name').text()).toBe('message.toolCall.call_default_name=tool1')
  expect(wrapper.find('.tool-header .tool-loader').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(false)
  expect(wrapper.find('.tool-params').exists()).toBe(false)
  expect(wrapper.find('.tool-result').exists()).toBe(false)

  await wrapper.find('.tool-container').trigger('click')
  expect(wrapper.find('.tool-header .tool-loader').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(true)
  expect(wrapper.find('.tool-params').exists()).toBe(true)
  expect(wrapper.find('.tool-result').exists()).toBe(true)

  expect(window.sessionStorage.getItem('opened-tools')).toStrictEqual('["tool1"]')

})

test('Basic rendering of running', async () => {
  
  const wrapper = mount(MessageItemToolBlock, { props: { toolCall: {
    id: 'tool2',
    name: 'tool2',
    status: 'running',
    done: false,
    params: { key: 'value' },
    result: undefined,
  }}})

  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-name').text()).toBe('running')
  expect(wrapper.find('.tool-header .tool-loader').exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(false)
  expect(wrapper.find('.tool-params').exists()).toBe(false)
  expect(wrapper.find('.tool-result').exists()).toBe(false)

  await wrapper.find('.tool-container').trigger('click')
  expect(wrapper.find('.tool-header .tool-loader').exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(false)
  expect(wrapper.find('.tool-params').exists()).toBe(true)
  expect(wrapper.find('.tool-result').exists()).toBe(false)

  expect(window.sessionStorage.getItem('opened-tools')).toStrictEqual('["tool1","tool2"]')
  await wrapper.find('.tool-container').trigger('click')
  expect(window.sessionStorage.getItem('opened-tools')).toStrictEqual('["tool1"]')
})

test('Params and result rendering', async () => {

  const wrapper = mount(MessageItemToolBlock, { props: { toolCall: {
    id: 'tool3',
    name: 'tool3',
    status: undefined,
    done: true,
    params: { key1: 'value1', key2: 'value2' },
    result: { result: 'response' },
  }}})

  await wrapper.find('.tool-container').trigger('click')
  expect(wrapper.find('.tool-header .tool-loader').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(true)
  expect(wrapper.find('.tool-params').exists()).toBe(true)
  expect(wrapper.find('.tool-result').exists()).toBe(true)

  expect(wrapper.findAll('.tool-params .tool-value')).toHaveLength(3)
  expect(wrapper.find('.tool-params .tool-value:nth-of-type(1)').text()).toBe('tooltool3')
  expect(wrapper.find('.tool-params .tool-value:nth-of-type(2)').text()).toBe('key1value1')
  expect(wrapper.find('.tool-params .tool-value:nth-of-type(3)').text()).toBe('key2value2')

  expect(wrapper.findAll('.tool-result .tool-value')).toHaveLength(1)
  expect(wrapper.find('.tool-result .tool-value:nth-of-type(1)').text()).toBe('resultresponse')

})

test('Does not toggle when text is being selected', async () => {

  vi.useFakeTimers()
  
  const wrapper = mount(MessageItemToolBlock, { props: { toolCall: {
    id: 'tool4',
    name: 'tool4',
    status: undefined,
    done: true,
    params: { key: 'value' },
    result: { result: 'result' },
  }}})

  // Should start closed
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(false)
  expect(wrapper.find('.tool-params').exists()).toBe(false)
  expect(wrapper.find('.tool-result').exists()).toBe(false)

  // Simulate selectstart (user starts selecting text)
  await wrapper.find('.tool-container').trigger('selectstart')
  
  // Click should not toggle when selecting
  await wrapper.find('.tool-container').trigger('click')
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(true)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(false)
  expect(wrapper.find('.tool-params').exists()).toBe(false)
  expect(wrapper.find('.tool-result').exists()).toBe(false)

  // Simulate mouseup (user finished selecting text, but text is still selected)
  await wrapper.find('.tool-container').trigger('mouseup')
  
  // Fast-forward the timer by 250ms
  vi.advanceTimersByTime(250)

  // Click should now toggle when not selecting
  await wrapper.find('.tool-container').trigger('click')
  expect(wrapper.find('.tool-header .tool-unfold').exists()).toBe(false)
  expect(wrapper.find('.tool-header .tool-fold').exists()).toBe(true)
  expect(wrapper.find('.tool-params').exists()).toBe(true)
  expect(wrapper.find('.tool-result').exists()).toBe(true)

  vi.useRealTimers()

})
