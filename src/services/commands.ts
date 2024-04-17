
import { Command } from '../types/index.d'
import { store } from './store'
import path from 'path'
import fs from 'fs'

import defaultCommands from '../../defaults/commands.json'

const commandsFilePath = () => {
  const userDataPath = store.userDataPath
  return path.join(userDataPath, 'commands.json')
}

export const installCommands = () => {

  // read file
  let commands = []
  try {
    const data = fs.readFileSync(commandsFilePath(), 'utf-8')
    commands = JSON.parse(data)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving commands data', error)
    }
  }

  // now add new commands
  for (const command of defaultCommands) {
    const c = commands.find((cmd: Command) => cmd.id === command.id)
    if (c == null) {
      commands.push(command)
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
    fs.writeFileSync(commandsFilePath(), JSON.stringify(store.commands, null, 2))
  } catch (error) {
    console.log('Error saving commands data', error)
  }

}
