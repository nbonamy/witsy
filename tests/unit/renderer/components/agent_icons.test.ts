
import { expect, test, describe } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusIcon from '@renderer/agent/StatusIcon.vue'
import TriggerIcon from '@renderer/agent/TriggerIcon.vue'

describe('StatusIcon.vue', () => {
  test('renders success icon', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: 'success' },
    })
    expect(wrapper.find('.success').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders error icon', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: 'error' },
    })
    expect(wrapper.find('.error').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders running spinner', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: 'running' },
    })
    expect(wrapper.find('.running').exists()).toBe(true)
  })

  test('renders canceled icon', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: 'canceled' },
    })
    expect(wrapper.find('.canceled').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders pending icon for unknown status', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: 'pending' },
    })
    expect(wrapper.find('.pending').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders pending icon for empty status', () => {
    const wrapper = mount(StatusIcon, {
      props: { status: '' },
    })
    expect(wrapper.find('.pending').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})

describe('TriggerIcon.vue', () => {
  test('renders manual icon', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: 'manual' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders schedule icon', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: 'schedule' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders webhook icon', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: 'webhook' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders workflow icon', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: 'workflow' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders circle icon for unknown trigger', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: 'unknown' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('renders circle icon for empty trigger', () => {
    const wrapper = mount(TriggerIcon, {
      props: { trigger: '' },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
