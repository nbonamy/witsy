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

    expect(wrapper.find('.category-list').exists()).toBe(true)
    expect(wrapper.findAll('.category-row')).toHaveLength(2)
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

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.category-list').exists()).toBe(false)
  })

  test('emits close event when close button clicked', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    await wrapper.find('.close-button').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('shows edit input when edit button clicked', async () => {
    const wrapper = mount(CategoryManager, {
      props: {
        categories: mockCategories,
        experts: mockExperts
      }
    })

    const editButtons = wrapper.findAll('.action-button')
    await editButtons[0].trigger('click')

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
    const editButtons = wrapper.findAll('.action-button')
    await editButtons[0].trigger('click')

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
    const editButtons = wrapper.findAll('.action-button')
    await editButtons[0].trigger('click')

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
    const editButtons = wrapper.findAll('.action-button')
    await editButtons[0].trigger('click')

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

    expect(wrapper.find('.new-category-section button').exists()).toBe(true)
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
    const rows = wrapper.findAll('.category-row')
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

    expect(wrapper.findAll('.category-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('System Category')
  })
})
