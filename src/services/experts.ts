
import { Expert } from 'types/index'
import { store } from './store'
import defaultExperts from '../../defaults/experts.json'

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

export const loadExperts = (): void => {
  try {
    store.experts = window.api.experts.load(store.config.workspaceId)
  } catch (error) {
    console.log('Error loading experts data', error)
    store.experts = JSON.parse(JSON.stringify(defaultExperts))
  }
}

export const saveExperts = (): void => {
  try {
    window.api.experts.save(store.config.workspaceId, JSON.parse(JSON.stringify(store.experts)))
  } catch (error) {
    console.log('Error saving experts data', error)
  }
}
