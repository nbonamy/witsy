
import { Command } from '../types/index.d'
import { store } from './store'
import defaultCommands from '../../defaults/commands.json'

export const newCommand = (): Command => {
  return {
    id: null,
    type: 'user',
    icon: null,
    label: 'New Command',
    action: 'chat_window',
    template: null,
    shortcut: '',
    engine: '',
    model: '',
    state: 'enabled'
  }
}

export const loadCommands = () => {
  try {
    return window.api.commands.load()
  } catch (error) {
    console.log('Error loading commands data', error)
    return JSON.parse(JSON.stringify(defaultCommands))
  }
}

export const saveCommands = () => {
  try {
    window.api.commands.save(JSON.parse(JSON.stringify(store.commands)))
  } catch (error) {
    console.log('Error saving commands data', error)
  }
}
