import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, test } from 'vitest'
import CategoryManager from '../../src/renderer/components/CategoryManager.vue'
import { kDefaultWorkspaceId } from '../../src/renderer/services/store'
import { Workspace } from '../../src/types/workspace'
import { useWindowMock } from '../mocks/window'

describe('CategoryManager', () => {

  beforeAll(() => {
    useWindowMock()
  })

  test('renders categories list', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.table-plain').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    // Mock provides 2 categories: cat-1 and cat-2
  })

  test('shows empty state when no categories', async () => {
    // @ts-expect-error mock
    window.api.experts.loadCategories.mockReturnValueOnce([])
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.table-plain').exists()).toBe(false)
  })

  test('emits close event when close icon clicked', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()
    await wrapper.find('.toolbar .actions button[name=close]').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('shows edit input when clicking category name', async () => {

    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    // Click on user category (last row)
    await wrapper.find('tbody tr:last-child td').trigger('click')
    expect(wrapper.find('.edit-input').exists()).toBe(true)
  })

  test('emits update when category name is edited', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    // Find the user category row (last one)
    await wrapper.find('tbody tr:last-child td').trigger('click')

    // Change name
    const input = wrapper.find('.edit-input')
    await input.setValue('Updated Name')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeTruthy()
  })

  test('cancels edit on escape key', async () => {

    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    // Start editing the user category
    await wrapper.find('tbody tr:last-child td').trigger('click')
    expect(wrapper.find('.edit-input').exists()).toBe(true)
    await wrapper.find('.edit-input').trigger('keydown.escape')
    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('does not save empty category name', async () => {

    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    // Start editing
    await wrapper.find('tbody tr:last-child td').trigger('click')

    // Try to save empty name
    const input = wrapper.find('.edit-input')
    await input.setValue('   ')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeFalsy()
    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('shows new category button', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toolbar button.primary').exists()).toBe(true)
  })

  test('shows eye icon for system categories and trash for user', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

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
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

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
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()

    // Click first category (which is system) to edit
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td').trigger('click')

    // Should show edit input (system categories can be edited now)
    expect(wrapper.find('.edit-input').exists()).toBe(true)
  })

  test('user categories show delete icon', async () => {
    const wrapper = mount(CategoryManager, { props: { workspace: { uuid: kDefaultWorkspaceId } as Workspace }})
    await wrapper.vm.$nextTick()
    const userRow = wrapper.findAll('tbody tr')[2] // Third row is user category
    expect(userRow.html()).toContain('lucide-trash')
  })
})
