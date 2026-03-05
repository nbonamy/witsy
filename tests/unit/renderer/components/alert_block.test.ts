import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import AlertBlock from '@components/AlertBlock.vue'

describe('AlertBlock', () => {

  describe('default rendering', () => {
    test('renders with default info variant', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Test Title' },
        slots: { default: '<p>Test body</p>' }
      })

      expect(wrapper.find('.alert-block').exists()).toBe(true)
      expect(wrapper.find('.alert-block.info').exists()).toBe(true)
    })

    test('renders title in header', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'My Alert' },
        slots: { default: '<p>Body</p>' }
      })

      expect(wrapper.find('.alert-header').text()).toContain('My Alert')
    })

    test('renders body slot content', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Title' },
        slots: { default: '<p>Alert body content</p>' }
      })

      expect(wrapper.find('.alert-body').text()).toContain('Alert body content')
    })
  })

  describe('variants', () => {
    test('renders error variant', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Error', variant: 'error' },
        slots: { default: '<p>Error message</p>' }
      })

      expect(wrapper.find('.alert-block.error').exists()).toBe(true)
    })

    test('renders warning variant', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Warning', variant: 'warning' },
        slots: { default: '<p>Warning message</p>' }
      })

      expect(wrapper.find('.alert-block.warning').exists()).toBe(true)
    })

    test('renders info variant', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Info', variant: 'info' },
        slots: { default: '<p>Info message</p>' }
      })

      expect(wrapper.find('.alert-block.info').exists()).toBe(true)
    })

    test('renders success variant', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Success', variant: 'success' },
        slots: { default: '<p>Success message</p>' }
      })

      expect(wrapper.find('.alert-block.success').exists()).toBe(true)
    })
  })

  describe('icon slot', () => {
    test('renders custom icon when provided', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Title' },
        slots: {
          default: '<p>Body</p>',
          icon: '<span class="custom-icon">!</span>'
        }
      })

      expect(wrapper.find('.alert-header .custom-icon').exists()).toBe(true)
    })

    test('header works without icon slot', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'No Icon' },
        slots: { default: '<p>Body</p>' }
      })

      expect(wrapper.find('.alert-header').text()).toBe('No Icon')
    })
  })

  describe('body slot', () => {
    test('renders buttons in body', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Title' },
        slots: {
          default: '<p>Description</p><button class="primary">Action</button>'
        }
      })

      expect(wrapper.find('.alert-body p').text()).toBe('Description')
      expect(wrapper.find('.alert-body button').text()).toBe('Action')
    })

    test('renders complex content in body', () => {
      const wrapper = mount(AlertBlock, {
        props: { title: 'Title' },
        slots: {
          default: '<div class="custom"><strong>Bold</strong> and <em>italic</em></div>'
        }
      })

      expect(wrapper.find('.alert-body .custom').exists()).toBe(true)
      expect(wrapper.find('.alert-body strong').text()).toBe('Bold')
    })
  })
})
