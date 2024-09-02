
import { Expert } from '../types'
import { store } from './store'
import defaultExperts from '../../defaults/experts.json'

export const newExpert = (): Expert => {
  return {
    id: null,
    type: 'user',
    name: 'New expert',
    prompt: '',
    state: 'enabled'
  }
}

export const loadExperts = (): void => {
  try {
    store.experts = window.api.experts.load()
  } catch (error) {
    console.log('Error loading experts data', error)
    store.experts = JSON.parse(JSON.stringify(defaultExperts))
  }
}

export const saveExperts = (): void => {
  try {
    window.api.experts.save(JSON.parse(JSON.stringify(store.experts)))
  } catch (error) {
    console.log('Error saving experts data', error)
  }
}
