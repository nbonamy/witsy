
import { Expert, ExpertCategory } from 'types/index'
import { t } from './i18n'
import { store } from './store'
import defaultExpertsData from '../../defaults/experts.json'

// Handle both old and new format
const defaultExperts = Array.isArray(defaultExpertsData) ? defaultExpertsData : (defaultExpertsData as any).experts
const defaultCategories = (defaultExpertsData as any).categories || []

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

export const newExpert = (): Expert => {
  return {
    id: null,
    type: 'user',
    name: 'New expert',
    prompt: '',
    state: 'enabled',
    triggerApps: []
  }
}

export const loadCategories = (workspaceId: string): void => {
  try {
    store.expertCategories = window.api.experts.loadCategories(workspaceId)
  } catch (error) {
    console.log('Error loading expert categories', error)
    store.expertCategories = JSON.parse(JSON.stringify(defaultCategories))
  }
}

export const loadExperts = (workspaceId: string): void => {
  try {
    store.experts = window.api.experts.load(workspaceId)
  } catch (error) {
    console.log('Error loading experts data', error)
    store.experts = JSON.parse(JSON.stringify(defaultExperts))
  }
}

export const saveExperts = (workspaceId: string): void => {
  try {
    window.api.experts.save(workspaceId, JSON.parse(JSON.stringify(store.experts)))
  } catch (error) {
    console.log('Error saving experts data', error)
  }
}

export const saveCategories = (workspaceId: string): void => {
  try {
    window.api.experts.saveCategories(workspaceId, JSON.parse(JSON.stringify(store.expertCategories)))
  } catch (error) {
    console.log('Error saving expert categories', error)
  }
}

export const trackExpertUsage = (workspaceId: string, expertId: string): void => {
  const expert = store.experts.find(e => e.id === expertId)
  if (!expert) return

  if (!expert.stats) {
    expert.stats = { timesUsed: 0 }
  }

  expert.stats.timesUsed++
  expert.stats.lastUsed = Date.now()

  saveExperts(workspaceId)
}
