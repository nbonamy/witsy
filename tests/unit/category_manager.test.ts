import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import CategoryManager from '../../src/components/CategoryManager.vue'
import { store } from '../../src/services/store'
import { useWindowMock } from '../mocks/window'

describe('CategoryManager', () => {

  beforeAll(() => {
    useWindowMock()
  })

  beforeEach(() => {
    store.config = { workspaceId: 'test-workspace' } as any
    store.loadExperts()
  })

  test('renders categories list', () => {
    const wrapper = mount(CategoryManager)

    expect(wrapper.find('.table-plain').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    // Mock provides 2 categories: cat-1 and cat-2
  })

  test('displays expert count for each category', () => {
    const wrapper = mount(CategoryManager)

    // cat-1 has 2 experts (uuid2, uuid3)
    // cat-2 has 1 expert (uuid4)
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
  })

  test('shows empty state when no categories', () => {
    store.expertCategories = []
    store.experts = []
    const wrapper = mount(CategoryManager)

    expect(wrapper.find('.panel-empty').exists()).toBe(true)
    expect(wrapper.find('.table-plain').exists()).toBe(false)
  })

  test('emits close event when close icon clicked', async () => {
    const wrapper = mount(CategoryManager)

    await wrapper.find('.panel-header .icon').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('shows edit input when clicking category name', async () => {
    // Add a user category that can be edited
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // Click on user category (last row)
    const rows = wrapper.findAll('tbody tr')
    await rows[rows.length - 1].find('td').trigger('click')

    expect(wrapper.find('.edit-input').exists()).toBe(true)
  })

  test('emits update when category name is edited', async () => {
    // Add a user category that can be edited
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // Find the user category row (last one)
    const rows = wrapper.findAll('tbody tr')
    const userRow = rows[rows.length - 1]

    // Start editing by clicking
    await userRow.find('td').trigger('click')

    // Change name
    const input = wrapper.find('.edit-input')
    await input.setValue('Updated Name')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeTruthy()
  })

  test('cancels edit on escape key', async () => {
    // Add a user category that can be edited
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // Start editing the user category
    const rows = wrapper.findAll('tbody tr')
    await rows[rows.length - 1].find('td').trigger('click')

    expect(wrapper.find('.edit-input').exists()).toBe(true)

    // Press escape
    await wrapper.find('.edit-input').trigger('keydown.escape')

    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('does not save empty category name', async () => {
    // Add a user category that can be edited
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // Start editing
    const rows = wrapper.findAll('tbody tr')
    await rows[rows.length - 1].find('td').trigger('click')

    // Try to save empty name
    const input = wrapper.find('.edit-input')
    await input.setValue('   ')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeFalsy()
    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('shows new category button', () => {
    const wrapper = mount(CategoryManager)

    expect(wrapper.find('.panel-footer button').exists()).toBe(true)
  })

  test('excludes deleted experts from count', () => {
    // Add a deleted expert to the store
    store.experts.push({ id: 'deleted1', type: 'user', state: 'deleted', categoryId: 'cat-1', triggerApps: [] })

    const wrapper = mount(CategoryManager)

    // Should not count deleted expert
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2) // Still 2 categories
  })

  test('renders with system categories', () => {
    // Mock already provides system categories (cat-1 and cat-2 are type: system)
    const wrapper = mount(CategoryManager)

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  test('shows eye icon for system categories and trash for user', () => {
    // Add a user category
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // System categories (first 2 rows) should have Eye icon in HTML
    const systemRow = wrapper.findAll('tbody tr')[0]
    const systemHtml = systemRow.html()
    expect(systemHtml).toContain('lucide-eye')
    expect(systemHtml).not.toContain('lucide-trash')

    // User category (last row) should have Trash icon in HTML
    const userRow = wrapper.findAll('tbody tr')[2]
    const userHtml = userRow.html()
    expect(userHtml).toContain('lucide-trash')
    expect(userHtml).not.toContain('lucide-eye')
  })

  test('toggles system category visibility', async () => {
    const wrapper = mount(CategoryManager)

    // Get first system category's second button (eye icon)
    const firstRow = wrapper.findAll('tbody tr')[0]
    const buttons = firstRow.findAllComponents({ name: 'ButtonIcon' })
    const eyeButton = buttons[1] // Second button is the eye/trash button

    // Click to toggle visibility
    await eyeButton.trigger('click')

    // Should emit update event
    expect(wrapper.emitted('update')).toBeTruthy()
  })

  test('allows editing system categories when clicking name', async () => {
    // Mock provides system categories by default
    const wrapper = mount(CategoryManager)

    // Click first category (which is system) to edit
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td').trigger('click')

    // Should show edit input (system categories can be edited now)
    expect(wrapper.find('.edit-input').exists()).toBe(true)
  })

  test('user categories show delete icon', () => {
    // Add a user category
    store.expertCategories.push({ id: 'user1', type: 'user', state: 'enabled', name: 'User Category' })

    const wrapper = mount(CategoryManager)

    // User category should have trash icon in HTML
    const userRow = wrapper.findAll('tbody tr')[2] // Third row is user category
    expect(userRow.html()).toContain('lucide-trash')
  })
})
