import { Chat } from '../types/index.d'
import { App } from 'electron'
import path from 'path'
import fs from 'fs'

const historyFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'history.json')
  return historyFilePath
}

export const historySize = (app: App): number => {
  try {
    return fs.statSync(historyFilePath(app)).size
  } catch (error) {
    return 0
  }
}

export const loadHistory = (app: App): Chat[] => {

  try {
    return JSON.parse(fs.readFileSync(historyFilePath(app), 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
    return null
  }

}

export const saveHistory = (app: App, content: Chat[]) => {
  try {
    fs.writeFileSync(historyFilePath(app), JSON.stringify(content, null, 2))
  } catch (error) {
    console.log('Error saving history data', error)
  }
}
