import { Chat } from '../types/index.d'
import { App } from 'electron'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

const monitor: Monitor = new Monitor('history')

const historyFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'history.json')
  return historyFilePath
}

export const loadHistory = (app: App): Chat[] => {

  try {
    monitor.start(historyFilePath(app))
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
