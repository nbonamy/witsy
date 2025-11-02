import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { createCategory, deleteCategory } from '../../src/services/categories'
import { store } from '../../src/services/store'
import { useWindowMock } from '../mocks/window'

describe('Category Service Functions', () => {

  beforeAll(() => {
    useWindowMock()
  })

  beforeEach(() => {
    store.config = { workspaceId: 'test-workspace' } as any
    store.loadExperts()
  })

  describe('createCategory', () => {
    test('should create a new category with correct defaults', () => {
      const category = createCategory('Test Category')

      expect(category.id).toBeDefined()
      expect(category.id.length).toBeGreaterThan(0)
      expect(category.type).toBe('user')
      expect(category.state).toBe('enabled')
      expect(category.name).toBe('Test Category')
    })

    test('should generate unique IDs for different categories', () => {
      const cat1 = createCategory('Category 1')
      const cat2 = createCategory('Category 2')

      expect(cat1.id).not.toBe(cat2.id)
    })
  })

  describe('deleteCategory - keep experts', () => {
    test('should remove category and uncategorize experts', () => {
      store.expertCategories = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'To Delete' },
        { id: 'cat2', type: 'user', state: 'enabled', name: 'Keep' }
      ]

      store.experts = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] },
        { id: 'exp3', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] }
      ]

      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', false)

      expect(updated.categories).toHaveLength(1)
      expect(updated.experts).toHaveLength(3)
      expect(updated.experts[0].categoryId).toBeUndefined()
      expect(updated.experts[1].categoryId).toBe('cat2')
      expect(updated.experts[2].categoryId).toBeUndefined()
    })

    test('should not delete any experts', () => {
      store.expertCategories = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      store.experts = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] }
      ]

      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', false)

      expect(updated.experts).toHaveLength(2)
      expect(updated.experts[0].state).toBe('enabled')
      expect(updated.experts[1].state).toBe('enabled')
    })
  })

  describe('deleteCategory - system categories', () => {
    test('should not delete system categories', () => {
      store.expertCategories = [
        { id: 'sys1', type: 'system', state: 'enabled', name: 'System' },
        { id: 'cat1', type: 'user', state: 'enabled', name: 'User' }
      ]

      store.experts = [
        { id: 'exp1', type: 'system', state: 'enabled', categoryId: 'sys1', triggerApps: [] }
      ]

      // Try to delete system category
      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', true)

      // System category should still exist
      expect(updated.categories).toHaveLength(1)
      expect(updated.categories.find(c => c.id === 'sys1')).toBeDefined()
      // Experts should be unchanged
      expect(updated.experts).toHaveLength(1)
      expect(updated.experts[0].state).toBe('enabled')
    })
  })

  describe('deleteCategory - delete experts', () => {
    test('should soft-delete system experts', () => {
      store.expertCategories = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      store.experts = [
        { id: 'exp1', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'system', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', true)

      expect(updated.experts).toHaveLength(2)
      expect(updated.experts[0].state).toBe('deleted')
      expect(updated.experts[1].state).toBe('enabled')
    })

    test('should hard-delete user experts', () => {
      store.expertCategories = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      store.experts = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', true)

      expect(updated.experts).toHaveLength(1)
      expect(updated.experts[0].id).toBe('exp2')
    })

    test('should handle mixed system and user experts', () => {
      store.expertCategories = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      store.experts = [
        { id: 'exp1', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp3', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const updated = deleteCategory(store.experts, store.expertCategories, 'cat1', true)

      expect(updated.experts).toHaveLength(2)
      expect(updated.experts[0].id).toBe('exp1')
      expect(updated.experts[0].state).toBe('deleted')
      expect(updated.experts[1].id).toBe('exp3')
    })
  })
})
