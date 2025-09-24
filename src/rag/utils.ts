
import { App } from 'electron'
import path from 'path'

export const docrepoFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const commandsFilePath = path.join(userDataPath, 'docrepo.json')
  return commandsFilePath
}

export const databasePath = (app: App, id: string): string => {
  const userDataPath = app.getPath('userData')
  const docRepoFolder = path.join(userDataPath, 'docrepo')
  const databasePath = path.join(docRepoFolder, id)
  return databasePath
}
