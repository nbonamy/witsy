
import { Expert } from '../types/index'
import { store } from './store'

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

export const trackExpertUsage = (expertId: string): void => {
  const expert = store.experts.find(e => e.id === expertId)
  if (!expert) return

  if (!expert.stats) {
    expert.stats = { timesUsed: 0 }
  }

  expert.stats.timesUsed++
  expert.stats.lastUsed = Date.now()

  window.api.experts.save(store.workspace.uuid, JSON.parse(JSON.stringify(store.experts)))
}
