import { Chat } from '../types/index.d'
import { App } from 'electron'
import Dropbox from './dropbox'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

const DROPBOX_PATH = '/history.json'

const monitor: Monitor = new Monitor('history')
let dropbox: Dropbox|null = null

const historyFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const historyFilePath = path.join(userDataPath, 'history.json')
  return historyFilePath
}

export const loadHistory = async (app: App): Promise<Chat[]> => {

  // // dropbox
  // if (!dropbox) {
  //   dropbox = new Dropbox(app, historyFilePath(app), DROPBOX_PATH)
  // }
  // await dropbox.downloadIfNeeded()

  // check existence
  if (!fs.existsSync(historyFilePath(app))) {
    return []
  }

  // local
  try {
    monitor.start(historyFilePath(app))
    //dropbox.monitor()
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

    // local
    fs.writeFileSync(historyFilePath(app), JSON.stringify(content, null, 2))
    monitor.start(historyFilePath(app))

    // // dropbox
    // const dropbox = new Dropbox(app, historyFilePath(app), DROPBOX_PATH)
    // dropbox.upload()
  
  } catch (error) {
    console.log('Error saving history data', error)
  }
}
