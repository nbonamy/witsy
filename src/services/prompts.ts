
import { store } from './store'
import defaultPrompts from '../../defaults/prompts.json'

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
    window.api.commands.save(JSON.parse(JSON.stringify(store.commands)))
  } catch (error) {
    console.log('Error saving commands data', error)
  }
}
