
import { beforeAll, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, h } from 'vue'
import { useWindowMock } from '@tests/mocks/window'

// Unmock IconPicker since this file tests the actual component
vi.unmock('@components/IconPicker.vue')

// Mock lucide-vue-next to only return a handful of icons for faster tests
vi.mock('lucide-vue-next', () => {
  // Create a simple icon component factory
  const createIcon = (name: string) => ({
    name,
    render: () => h('svg', { class: 'lucide-icon', 'data-icon': name })
  })

  return {
    icons: {
      Globe: createIcon('Globe'),
      GlobeIcon: createIcon('GlobeIcon'),
      Globe2: createIcon('Globe2'),
      Home: createIcon('Home'),
      Settings: createIcon('Settings'),
      User: createIcon('User'),
      Search: createIcon('Search'),
      Star: createIcon('Star'),
      Heart: createIcon('Heart'),
      Mail: createIcon('Mail'),
    },
    Globe: createIcon('Globe'),
    GlobeIcon: createIcon('GlobeIcon'),
  }
})

import IconPicker from '@components/IconPicker.vue'

beforeAll(() => {
  useWindowMock()
})

test('IconPicker renders with search input', () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  expect(wrapper.find('.search-input').exists()).toBe(true)
  expect(wrapper.find('.icon-grid').exists()).toBe(true)
})

test('IconPicker displays Lucide icons', () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  const iconItems = wrapper.findAll('.icon-item')
  expect(iconItems.length).toBeGreaterThan(0)
})

test('IconPicker filters icons by search query', async () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  const initialCount = wrapper.findAll('.icon-item').length

  // Search for "Globe"
  const searchInput = wrapper.find('.search-input')
  await searchInput.setValue('Globe')
  await nextTick()

  const filteredCount = wrapper.findAll('.icon-item').length

  // Should show fewer icons
  expect(filteredCount).toBeLessThan(initialCount)
  expect(filteredCount).toBeGreaterThan(0)
})

test('IconPicker highlights selected icon', () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: 'Globe'
    }
  })

  const selectedItems = wrapper.findAll('.icon-item.selected')
  expect(selectedItems.length).toBeGreaterThan(0)
})

test('IconPicker emits update on icon click', async () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  const firstIcon = wrapper.find('.icon-item')
  await firstIcon.trigger('click')

  expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  expect(wrapper.emitted('update:modelValue')?.[0]).toBeTruthy()
  expect(typeof wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('string')
})

test('IconPicker changes selection when different icon clicked', async () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: 'Globe'
    }
  })

  // Click another icon
  const allIcons = wrapper.findAll('.icon-item')
  expect(allIcons.length).toBeGreaterThan(1)

  await allIcons[1].trigger('click')

  expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  const emittedValue = wrapper.emitted('update:modelValue')?.[0]?.[0]
  expect(emittedValue).not.toBe('Globe')
  expect(typeof emittedValue).toBe('string')
})

test('IconPicker shows all icons when search is cleared', async () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  const initialCount = wrapper.findAll('.icon-item').length

  // Search
  const searchInput = wrapper.find('.search-input')
  await searchInput.setValue('Globe')
  await nextTick()

  const filteredCount = wrapper.findAll('.icon-item').length
  expect(filteredCount).toBeLessThan(initialCount)

  // Clear search
  await searchInput.setValue('')
  await nextTick()

  const finalCount = wrapper.findAll('.icon-item').length
  expect(finalCount).toBe(initialCount)
})

test('IconPicker search is case insensitive', async () => {
  const wrapper = mount(IconPicker, {
    props: {
      modelValue: null
    }
  })

  // Search with lowercase
  const searchInput = wrapper.find('.search-input')
  await searchInput.setValue('globe')
  await nextTick()

  const lowerCount = wrapper.findAll('.icon-item').length

  // Clear and search with uppercase
  await searchInput.setValue('GLOBE')
  await nextTick()

  const upperCount = wrapper.findAll('.icon-item').length

  // Should return same results
  expect(lowerCount).toBe(upperCount)
  expect(lowerCount).toBeGreaterThan(0)
})
