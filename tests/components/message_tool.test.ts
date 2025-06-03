
import { vi, beforeAll, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import MessageItemToolBlock from '../../src/components/MessageItemToolBlock.vue'
import { beforeEach } from 'node:test'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string, values: Record<string, any>) => !values ? key : `${key}-${Object.values(values)}`,
  }
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  window.localStorage.clear()
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
  expect(wrapper.find('.tool-header .tool-name').text()).toBe('message.toolCall.call-tool1')
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

  expect(window.localStorage.getItem('opened-tools')).toStrictEqual('["tool1"]')

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

  expect(window.localStorage.getItem('opened-tools')).toStrictEqual('["tool1","tool2"]')
  await wrapper.find('.tool-container').trigger('click')
  expect(window.localStorage.getItem('opened-tools')).toStrictEqual('["tool1"]')
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

  expect(wrapper.findAll('.tool-params .tool-value')).toHaveLength(2)
  expect(wrapper.find('.tool-params .tool-value:nth-of-type(1)').text()).toBe('key1value1')
  expect(wrapper.find('.tool-params .tool-value:nth-of-type(2)').text()).toBe('key2value2')

  expect(wrapper.findAll('.tool-result .tool-value')).toHaveLength(1)
  expect(wrapper.find('.tool-result .tool-value:nth-of-type(1)').text()).toBe('resultresponse')

})
