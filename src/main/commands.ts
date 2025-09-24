import { Command } from 'types/index'
import { app, App } from 'electron'
import { createI18n } from './i18n.base'
import { getLocaleMessages } from './i18n'
import defaultCommands from '../../defaults/commands.json'
import Monitor from './monitor'
import * as window from './window'
import * as file from './file'
import path from 'path'
import fs from 'fs'

const monitor: Monitor = new Monitor(() => {
  window.notifyBrowserWindows('file-modified', 'commands');
})

export const commandsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData') + '2'
  const commandsFilePath = path.join(userDataPath, 'commands.json')
  return commandsFilePath
}

export const loadCommands = (source: App|string): Command[] => {

  // init
  let commands: Command[] = []
  const commandsFile = typeof source === 'string' ? source : commandsFilePath(source)

  // read
  try {
    commands = JSON.parse(fs.readFileSync(commandsFile, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving commands', error)
    }
  }

  // migrations can update
  let updated = false

  // i18n migrate label and template
  const t = createI18n(getLocaleMessages(app), 'en', { missingWarn: false }).global.t as CallableFunction
  for (const command of commands) {
    const key = `commands.commands.${command.id}`
    if (command.label === t(`${key}.label`)) {
      delete command.label
      updated = true
    }
    if (command.template === t(`${key}.template`)) {
      delete command.template
      updated = true
    }
  }

  // now add new commands
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
    saveCommands(source, commands)
  }

  // start monitoring
  if (typeof source !== 'string') {
    monitor.start(commandsFile)
  }

  // done
  return commands

}

export const saveCommands = (dest: App|string, content: Command[]) => {
  try {
    const commandsFile = typeof dest === 'string' ? dest : commandsFilePath(dest)
    fs.writeFileSync(commandsFile, JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving commands', error)
  }
}

export const exportCommands = (app: App) => {

  // pick a directory
  const filepath = file.pickDirectory(app)
  if (!filepath) {
    return false
  }

  // load defaults file content
  const contents = fs.readFileSync(commandsFilePath(app), 'utf-8')

  // write
  const target = path.join(filepath, 'commands.json')
  fs.writeFileSync(target, contents)
  
  // done
  return true

}

export const importCommands = (app: App) => {

  // pick the file
  const filename = file.pickFile(app, { location: true, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!filename) {
    return false
  }

  // read and write
  const contents = fs.readFileSync(filename as string, 'utf-8')
  fs.writeFileSync(commandsFilePath(app), contents)

  // done
  return true

}
