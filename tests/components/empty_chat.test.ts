
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/renderer/services/store'
import EmptyChat from '../../src/renderer/components/EmptyChat.vue'

// Mock the i18n service
vi.mock('../../src/renderer/services/i18n', () => createI18nMock())

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.loadAgents()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders empty chat component', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.empty')).toBeTruthy()
})

test('Shows greeting heading', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)
  const heading = wrapper.find('h1')
  expect(heading.exists()).toBe(true)
  expect(heading.text()).toBe('chat.empty.greeting')
})

test('Shows agent shortcuts when agents exist', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  // Should show shortcuts header
  const header = wrapper.find('.shortcuts-header')
  expect(header.exists()).toBe(true)
  expect(header.text()).toContain('common.agents')

  // Should show shortcuts list
  const shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBeGreaterThan(0)
  expect(shortcuts.length).toBeLessThanOrEqual(3) // Shows max 3 initially
})

test('Shows agent names and descriptions in shortcuts', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  const shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBeGreaterThan(0)

  // First shortcut should have name and description props
  const firstShortcut = shortcuts[0]
  expect(firstShortcut.props('name')).toBeTruthy()
  expect(firstShortcut.props('description')).toBeTruthy()
})

test('Shows "show more" button initially', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  const showMoreBtn = wrapper.find('.shortcuts-header .icon')
  expect(showMoreBtn.exists()).toBe(true)
  expect(showMoreBtn.text()).toContain('common.showMore')
})

test('Expands shortcuts when clicking show more', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  // Initially shows max 3
  let shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  const initialCount = shortcuts.length
  expect(initialCount).toBeLessThanOrEqual(3)

  // Click show more
  const showMoreBtn = wrapper.find('.shortcuts-header .icon')
  await showMoreBtn.trigger('click')
  await nextTick()

  // Should show all shortcuts now
  shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBeGreaterThanOrEqual(initialCount)

  // Button should now say "show less"
  const showLessBtn = wrapper.find('.shortcuts-header .icon')
  expect(showLessBtn.text()).toContain('common.showLess')
})

test('Collapses shortcuts when clicking show less', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  // Expand first
  const showMoreBtn = wrapper.find('.shortcuts-header .icon')
  await showMoreBtn.trigger('click')
  await nextTick()

  let shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  const expandedCount = shortcuts.length

  // Click show less
  const showLessBtn = wrapper.find('.shortcuts-header .icon')
  await showLessBtn.trigger('click')
  await nextTick()

  // Should show only 3 again
  shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBeLessThanOrEqual(3)

  // Only check if there were more than 3 to begin with
  if (expandedCount > 3) {
    expect(shortcuts.length).toBeLessThan(expandedCount)
  }
})

test('Emits run-agent event when clicking a shortcut', async () => {
  const wrapper: VueWrapper<any> = mount(EmptyChat)

  const shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBeGreaterThan(0)

  // Trigger run event on first shortcut
  await shortcuts[0].vm.$emit('run')
  await nextTick()

  // Should emit run-agent event
  expect(wrapper.emitted('run-agent')).toBeTruthy()
  expect(wrapper.emitted('run-agent')![0]).toBeTruthy()
})

test('Shows fallback shortcuts when no agents exist', async () => {
  // Temporarily clear agents
  const originalAgents = store.agents
  store.agents = []

  const wrapper: VueWrapper<any> = mount(EmptyChat)
  await nextTick()

  // Should show fallback shortcuts (Agent Forge, MCP Servers, Doc Repo)
  const shortcuts = wrapper.findAllComponents({ name: 'HomeShortcut' })
  expect(shortcuts.length).toBe(3)

  // Restore agents
  store.agents = originalAgents
})
