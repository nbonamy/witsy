import { Expert, ExpertCategory } from '../types/index'
import { store } from './store'

export const createCategory = (name: string): ExpertCategory => {
  return {
    id: crypto.randomUUID(),
    type: 'user',
    state: 'enabled',
    name: name,
  }
}

export const updateCategory = (categoryId: string, name: string): void => {
  const category = store.expertCategories.find(c => c.id === categoryId)
  if (category) {
    category.name = name
  }
}

export const deleteCategory = (
  categoryId: string,
  deleteExperts: boolean,
): void => {

  // Remove category
  store.expertCategories = store.expertCategories.filter(c => c.id !== categoryId)

  // Handle experts in this category
  const updatedExperts: Expert[] = [...store.experts]

  if (deleteExperts) {
    // Delete experts: system experts are soft-deleted, user experts are removed
    store.experts = updatedExperts.map(e => {
      if (e.categoryId === categoryId) {
        if (e.type === 'system') {
          return { ...e, state: 'deleted' as const }
        }
        return null // Will be filtered out
      }
      return e
    }).filter(e => e !== null) as Expert[]
  } else {
    // Keep experts but uncategorize them
    store.experts = updatedExperts.map(e => {
      if (e.categoryId === categoryId) {
        return { ...e, categoryId: undefined }
      }
      return e
    })
  }

}
