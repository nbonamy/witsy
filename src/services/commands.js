
import { store } from './store.js'
import defaultCommands from '../../defaults/commands'
import path from 'path'
import fs from 'fs'

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
  for (let command of defaultCommands) {
    let c = commands.find((cmd) => cmd.id === command.id)
    if (c == null) {
      commands.push(command)
    }
  }

  // save
  store.commands = commands
  saveCommands()

}

export const saveCommands = () => {
  
  // save file
  try {
    fs.writeFileSync(commandsFilePath(), JSON.stringify(store.commands))
  } catch (error) {
    console.log('Error saving commands data', error)
  }

}
