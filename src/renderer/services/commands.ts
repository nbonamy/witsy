
import { Command } from 'types/index'
import defaultCommands from '@root/defaults/commands.json'
import { store } from './store'

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

export const loadCommands = (): void => {
  try {
    store.commands = window.api.commands.load()
  } catch (error) {
    console.log('Error loading commands data', error)
    store.commands = JSON.parse(JSON.stringify(defaultCommands))
  }
}

export const saveCommands = (): void => {
  try {
    window.api.commands.save(JSON.parse(JSON.stringify(store.commands)))
  } catch (error) {
    console.log('Error saving commands data', error)
  }
}
