import { v4 as uuidv4 } from 'uuid'
import { Expert, ExpertCategory } from '../types/index'
import { t } from './i18n'

export const getCategoryById = (categoryId?: string, categories?: ExpertCategory[]): ExpertCategory | undefined => {
  if (!categoryId || !categories) return undefined
  return categories.find(c => c.id === categoryId)
}

export const getCategoryLabel = (categoryId?: string, categories?: ExpertCategory[]): string => {
  if (!categoryId || !categories) return 'Uncategorized'
  const category = getCategoryById(categoryId, categories)
  if (!category) return 'Uncategorized'

  // Try to get i18n label
  try {
    const label = t(`experts.categories.${category.id}.name`)
    if (label && !label.startsWith('experts.categories')) {
      return label
    }
  } catch {
    // Fallback to default
  }

  return 'Uncategorized'
}

export const createCategory = (name: string): ExpertCategory => {
  return {
    id: uuidv4(),
    type: 'user',
    state: 'enabled',
    name: name,
  }
}

export const updateCategory = (categoryId: string, name: string, categories: ExpertCategory[]): ExpertCategory[] => {
  const category = categories.find(c => c.id === categoryId)
  if (category) {
    category.name = name
  }
  return categories
}

export const deleteCategory = (
  categoryId: string,
  deleteExperts: boolean,
  categories: ExpertCategory[],
  experts: Expert[]
): { categories: ExpertCategory[], experts: Expert[] } => {

  // Remove category
  const updatedCategories = categories.filter(c => c.id !== categoryId)

  // Handle experts in this category
  let updatedExperts = [...experts]

  if (deleteExperts) {
    // Delete experts: system experts are soft-deleted, user experts are removed
    updatedExperts = experts.map(e => {
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
    updatedExperts = experts.map(e => {
      if (e.categoryId === categoryId) {
        return { ...e, categoryId: undefined }
      }
      return e
    })
  }

  return {
    categories: updatedCategories,
    experts: updatedExperts
  }
}

export const saveCategories = (workspaceId: string, categories: ExpertCategory[]): void => {
  window.api.experts.saveCategories(workspaceId, categories)
}
