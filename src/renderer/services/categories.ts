import { Expert, ExpertCategory } from 'types/index'

export const createCategory = (name: string): ExpertCategory => {
  return {
    id: crypto.randomUUID(),
    type: 'user',
    state: 'enabled',
    name: name,
  }
}

export const deleteCategory = (
  experts: Expert[],
  categories: ExpertCategory[],
  categoryId: string,
  deleteExperts: boolean,
): { experts: Expert[], categories: ExpertCategory[] } => {

  // System categories cannot be deleted
  const category = categories.find(c => c.id === categoryId)
  if (!category || category.type === 'system') return

  // Remove user category
  categories = categories.filter(c => c.id !== categoryId)

  // Handle experts in this category
  const updatedExperts: Expert[] = [...experts]

  if (deleteExperts) {
    // Delete experts: system experts are soft-deleted, user experts are removed
    return { categories, experts: updatedExperts.map(e => {
        if (e.categoryId === categoryId) {
          if (e.type === 'system') {
            return { ...e, state: 'deleted' as const }
          }
          return null // Will be filtered out
        }
        return e
      }).filter(e => e !== null) as Expert[]
    }
  } else {
    // Keep experts but uncategorize them
    return { categories, experts: updatedExperts.map(e => {
        if (e.categoryId === categoryId) {
          return { ...e, categoryId: undefined }
        }
        return e
      })
    }
  }

}
