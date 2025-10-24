
import { Expert, ExpertCategory } from 'types/index'
import { t } from './i18n'
import defaultExpertsData from '../../defaults/experts.json'

// Handle both old and new format
const defaultExperts = Array.isArray(defaultExpertsData) ? defaultExpertsData : (defaultExpertsData as any).experts

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

export const migrateExperts = (experts: Expert[]): Expert[] => {
  return experts.map(expert => {
    // Remove old category field (backward compatibility)
    if ((expert as any).category) {
      delete (expert as any).category
    }

    // Initialize stats if missing
    if (!expert.stats) {
      expert.stats = { timesUsed: 0 }
    }

    return expert
  })
}

export const loadExperts = (workspaceId: string): Expert[] => {
  try {
    let experts = window.api.experts.load(workspaceId)
    experts = migrateExperts(experts)
    return experts
  } catch (error) {
    console.log('Error loading experts data', error)
    return JSON.parse(JSON.stringify(defaultExperts))
  }
}

export const saveExperts = (workspaceId: string, experts: Expert[]): void => {
  try {
    window.api.experts.save(workspaceId, JSON.parse(JSON.stringify(experts)))
  } catch (error) {
    console.log('Error saving experts data', error)
  }
}

export const trackExpertUsage = (expertId: string, experts: Expert[], workspaceId: string): void => {
  const expert = experts.find(e => e.id === expertId)
  if (!expert) return

  if (!expert.stats) {
    expert.stats = { timesUsed: 0 }
  }

  expert.stats.timesUsed++
  expert.stats.lastUsed = Date.now()

  saveExperts(workspaceId, experts)
}
