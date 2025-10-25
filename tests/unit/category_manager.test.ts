import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, test } from 'vitest'
import CategoryManager from '../../src/components/CategoryManager.vue'
import { Expert, ExpertCategory } from '../../src/types'
import { useWindowMock } from '../mocks/window'

describe('CategoryManager', () => {

  beforeAll(() => {
    useWindowMock()
  })

  const mockCategories: ExpertCategory[] = [
    { id: 'cat1', type: 'user', state: 'enabled', name: 'Category 1' },
    { id: 'cat2', type: 'user', state: 'enabled', name: 'Category 2' }
  ]

  const mockExperts: Expert[] = [
    { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
    { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
    { id: 'exp3', type: 'system', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
  ]

  test('renders categories list', () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    expect(wrapper.find('.table-plain').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Category 1')
    expect(wrapper.text()).toContain('Category 2')
  })

  test('displays expert count for each category', () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    expect(wrapper.text()).toContain('(2)') // Category 1 has 2 experts
    expect(wrapper.text()).toContain('(1)') // Category 2 has 1 expert
  })

  test('shows empty state when no categories', () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: [],
        experts: []
      }
    })

    expect(wrapper.find('.panel-empty').exists()).toBe(true)
    expect(wrapper.find('.table-plain').exists()).toBe(false)
  })

  test('emits close event when close icon clicked', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    await wrapper.find('.panel-header .icon').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('shows edit input when clicking category name', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td span').trigger('click')

    expect(wrapper.find('.edit-input').exists()).toBe(true)
  })

  test('emits update when category name is edited', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    // Start editing
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td span').trigger('click')

    // Change name
    const input = wrapper.find('.edit-input')
    await input.setValue('Updated Name')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeTruthy()
    const emitted = wrapper.emitted('update') as any[]
    expect(emitted[0][0]).toContainEqual(
      expect.objectContaining({ id: 'cat1', name: 'Updated Name' })
    )
  })

  test('cancels edit on escape key', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    // Start editing
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td span').trigger('click')

    expect(wrapper.find('.edit-input').exists()).toBe(true)

    // Press escape
    await wrapper.find('.edit-input').trigger('keydown.escape')

    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('does not save empty category name', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    // Start editing
    const firstRow = wrapper.findAll('tbody tr')[0]
    await firstRow.find('td span').trigger('click')

    // Try to save empty name
    const input = wrapper.find('.edit-input')
    await input.setValue('   ')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update')).toBeFalsy()
    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('shows new category button', () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    expect(wrapper.find('.panel-footer button').exists()).toBe(true)
  })

  test('excludes deleted experts from count', () => {
    const expertsWithDeleted: Expert[] = [
      ...mockExperts,
      { id: 'exp4', type: 'user', state: 'deleted', categoryId: 'cat1', triggerApps: [] }
    ]

    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: expertsWithDeleted
      }
    })

    // Should still show (2) for cat1, not (3)
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('(2)')
  })

  test('renders with system categories', () => {
    const categoriesWithSystem: ExpertCategory[] = [
      { id: 'sys1', type: 'system', state: 'enabled', name: 'System Category' },
      ...mockCategories
    ]

    const wrapper = mount(CategoryManager, {
      props: {
        categories: categoriesWithSystem,
        experts: mockExperts
      }
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('System Category')
  })

  test('disables edit and delete icons for system categories', () => {
    const categoriesWithSystem: ExpertCategory[] = [
      { id: 'sys1', type: 'system', state: 'enabled', name: 'System Category' },
      { id: 'user1', type: 'user', state: 'enabled', name: 'User Category' }
    ]

    const wrapper = mount(CategoryManager, {
      props: {
        categories: categoriesWithSystem,
        experts: []
      }
    })

    const rows = wrapper.findAll('tbody tr')

    // System category row should have disabled class somewhere in actions
    const systemActionsHtml = rows[0].find('.actions').html()
    expect(systemActionsHtml).toContain('disabled')

    // User category row should not have disabled class
    const userActionsHtml = rows[1].find('.actions').html()
    expect(userActionsHtml).not.toContain('disabled')
  })

  test('prevents editing system categories when clicking name', async () => {
    const systemCategory: ExpertCategory = { id: 'sys1', type: 'system', state: 'enabled', name: 'System' }

    const wrapper = mount(CategoryManager, {
      props: {
        categories: [systemCategory],
        experts: []
      }
    })

    // Try to edit by clicking the name
    await wrapper.find('td span').trigger('click')

    // Should not show edit input
    expect(wrapper.find('.edit-input').exists()).toBe(false)
  })

  test('prevents deleting system categories when clicking icon', async () => {
    const systemCategory: ExpertCategory = { id: 'sys1', type: 'system', state: 'enabled', name: 'System' }

    const wrapper = mount(CategoryManager, {
      props: {
        categories: [systemCategory],
        experts: []
      }
    })

    // Try to delete by clicking the icon
    const allIcons = wrapper.findAllComponents({ name: 'Trash2Icon' })
    if (allIcons.length > 0) {
      await allIcons[0].trigger('click')
    }

    // Should not emit update
    expect(wrapper.emitted('update')).toBeFalsy()
  })
})
