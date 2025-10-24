
import defaultExpertsData from '../../defaults/experts.json'
import { Expert } from '../types/index'
import { store } from './store'

// Handle both old and new format
const defaultExperts = Array.isArray(defaultExpertsData) ? defaultExpertsData : (defaultExpertsData as any).experts
const defaultCategories = (defaultExpertsData as any).categories || []

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
