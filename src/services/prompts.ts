
import { Prompt } from '../types/index.d'
import { store } from './store'
import defaultPrompts from '../../defaults/prompts.json'

export const newPrompt = (): Prompt => {
  return {
    id: null,
    type: 'user',
    actor: 'New prompt',
    prompt: '',
    state: 'enabled'
  }
}

export const loadPrompts = (): void => {
  try {
    store.prompts = window.api.prompts.load()
  } catch (error) {
    console.log('Error loading prompts data', error)
    store.prompts = JSON.parse(JSON.stringify(defaultPrompts))
  }
}

export const savePrompts = (): void => {
  try {
    window.api.prompts.save(JSON.parse(JSON.stringify(store.prompts)))
  } catch (error) {
    console.log('Error saving prompts data', error)
  }
}
