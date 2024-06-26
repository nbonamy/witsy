import { Command } from '../types/index.d'
import defaultCommands from '../../defaults/commands.json'
import { App } from 'electron'
import path from 'path'
import fs from 'fs'

const commandsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const commandsFilePath = path.join(userDataPath, 'commands.json')
  return commandsFilePath
}

export const loadCommands = (app: App): Command[] => {

  // init
  let commands: Command[] = []

  // read
  try {
    commands = JSON.parse(fs.readFileSync(commandsFilePath(app), 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }

  // now add new commands
  let updated = false
  for (const command of defaultCommands) {
    const c = commands.find((cmd: Command) => cmd.id === command.id)
    if (c == null) {
      commands.push(command as Command)
      updated = true
    } else {
      if (c.shortcut === undefined) {
        c.shortcut = command.shortcut || ''
        updated = true
      }
    }
  }

  // save if needed
  if (updated) {
    saveCommands(app, commands)
  }

  // done
  return commands

}

export const saveCommands = (app: App, content: Command[]) => {
  try {
    fs.writeFileSync(commandsFilePath(app), JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving history data', error)
  }
}
