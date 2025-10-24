
import { ExpertCategory } from '../types/index'
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
