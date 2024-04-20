
import { Command } from '../types/index.d'
import { store } from './store'
import defaultCommands from '../../defaults/commands.json'

export const installCommands = () => {

  // read file
  let commands: Command[] = []
  try {
    commands = window.api.commands.load()
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving commands data', error)
    }
  }

  // now add new commands
  for (const command of defaultCommands) {
    const c = commands.find((cmd: Command) => cmd.id === command.id)
    if (c == null) {
      commands.push(command as Command)
    } else {
      if (c.shortcut === undefined) {
        c.shortcut = command.shortcut || ''
      }
    }
  }

  // save
  store.commands = commands
  saveCommands()

}

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

export const saveCommands = () => {
  
  // save file
  try {
    window.api.commands.save(JSON.parse(JSON.stringify(store.commands)))
  } catch (error) {
    console.log('Error saving commands data', error)
  }

}
