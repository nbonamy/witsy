import { expect, test, describe, beforeAll } from 'vitest'
import { createCategory, updateCategory, deleteCategory, saveCategories } from '../../src/services/categories'
import { Expert, ExpertCategory } from '../../src/types'
import { useWindowMock } from '../mocks/window'

describe('Category Service Functions', () => {

  beforeAll(() => {
    useWindowMock()
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

  describe('updateCategory', () => {
    test('should update category name', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Old Name' },
        { id: 'cat2', type: 'user', state: 'enabled', name: 'Other' }
      ]

      const updated = updateCategory('cat1', 'New Name', categories)

      expect(updated[0].name).toBe('New Name')
      expect(updated[1].name).toBe('Other')
    })

    test('should not modify other categories', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'First' },
        { id: 'cat2', type: 'user', state: 'enabled', name: 'Second' }
      ]

      updateCategory('cat1', 'Updated', categories)

      expect(categories[1].name).toBe('Second')
    })

    test('should handle non-existent category gracefully', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'First' }
      ]

      const updated = updateCategory('nonexistent', 'New', categories)

      expect(updated).toEqual(categories)
    })
  })

  describe('deleteCategory - keep experts', () => {
    test('should remove category and uncategorize experts', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'To Delete' },
        { id: 'cat2', type: 'user', state: 'enabled', name: 'Keep' }
      ]

      const experts: Expert[] = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] },
        { id: 'exp3', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] }
      ]

      const result = deleteCategory('cat1', false, categories, experts)

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0].id).toBe('cat2')
      expect(result.experts).toHaveLength(3)
      expect(result.experts[0].categoryId).toBeUndefined()
      expect(result.experts[1].categoryId).toBe('cat2')
      expect(result.experts[2].categoryId).toBeUndefined()
    })

    test('should not delete any experts', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      const experts: Expert[] = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] }
      ]

      const result = deleteCategory('cat1', false, categories, experts)

      expect(result.experts).toHaveLength(2)
      expect(result.experts[0].state).toBe('enabled')
      expect(result.experts[1].state).toBe('enabled')
    })
  })

  describe('deleteCategory - delete experts', () => {
    test('should soft-delete system experts', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      const experts: Expert[] = [
        { id: 'exp1', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'system', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const result = deleteCategory('cat1', true, categories, experts)

      expect(result.experts).toHaveLength(2)
      expect(result.experts[0].state).toBe('deleted')
      expect(result.experts[1].state).toBe('enabled')
    })

    test('should hard-delete user experts', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      const experts: Expert[] = [
        { id: 'exp1', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const result = deleteCategory('cat1', true, categories, experts)

      expect(result.experts).toHaveLength(1)
      expect(result.experts[0].id).toBe('exp2')
    })

    test('should handle mixed system and user experts', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Delete' }
      ]

      const experts: Expert[] = [
        { id: 'exp1', type: 'system', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp2', type: 'user', state: 'enabled', categoryId: 'cat1', triggerApps: [] },
        { id: 'exp3', type: 'user', state: 'enabled', categoryId: 'cat2', triggerApps: [] }
      ]

      const result = deleteCategory('cat1', true, categories, experts)

      expect(result.experts).toHaveLength(2)
      expect(result.experts[0].id).toBe('exp1')
      expect(result.experts[0].state).toBe('deleted')
      expect(result.experts[1].id).toBe('exp3')
    })
  })

  describe('saveCategories', () => {
    test('should call window.api.experts.saveCategories with correct parameters', () => {
      const categories: ExpertCategory[] = [
        { id: 'cat1', type: 'user', state: 'enabled', name: 'Test' }
      ]

      saveCategories('workspace-123', categories)

      expect(window.api.experts.saveCategories).toHaveBeenCalledWith('workspace-123', categories)
    })
  })
})
