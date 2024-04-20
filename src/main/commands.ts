import { Command } from '../types/index.d'
import { App } from 'electron'
import path from 'path'
import fs from 'fs'

const commandsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'commands.json')
  return historyFilePath
}

export const loadCommands = (app: App): Command[] => {
  try {
    return JSON.parse(fs.readFileSync(commandsFilePath(app), 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }
}

export const saveCommands = (app: App, content: Command[]) => {
  try {
    fs.writeFileSync(commandsFilePath(app), JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving history data', error)
  }
}
