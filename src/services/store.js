
import { reactive } from 'vue'
import { ipcRenderer } from 'electron'
import buildConfig from './config'
import Chat from '../models/chat'
import path from 'path'
import fs from 'fs'

let defaultSettings = null

export const store = reactive({
  userDataPath: null,
  commands: [], 
  config: {},
  chats: [],
  models: {
    openai: null,
    ollama: null,
  },
  pendingAttachment: null
})

store.load = (defaults = {}) => {
  store.userDataPath = ipcRenderer.sendSync('get-app-path')
  defaultSettings = defaults
  loadSettings(defaults)
  loadHistory()
}

store.save = () => {
  saveHistory()
  saveSettings()
}

store.cleanEmptyChats = () => {
  store.chats = store.chats.filter((chat) => chat.messages.length > 1)
}

store.dump = () => {
  console.dir(JSON.parse(JSON.stringify(store.config)))
}

const historyFilePath = () => {
  return path.join(store.userDataPath, 'history.json')
}

const settingsFilePath = () => {
  return path.join(store.userDataPath, 'settings.json')
}

const loadHistory = () => {
  try {
    store.chats = []
    const data = fs.readFileSync(historyFilePath(), 'utf-8')
    const jsonChats = JSON.parse(data)
    for (let jsonChat of jsonChats) {
      let chat = new Chat(jsonChat)
      store.chats.push(chat)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }
}

const saveHistory = () => {
  try {
    fs.writeFileSync(historyFilePath(), JSON.stringify(store.chats.filter((chat) => chat.messages.length > 1)))
  } catch (error) {
    console.log('Error saving history data', error)
  }
}

const loadSettings = (defaults) => {
  let data = '{}'
  try {
    data = fs.readFileSync(settingsFilePath(), 'utf-8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving settings data', error)
    }
  }
  store.config = buildConfig(defaults, JSON.parse(data))
}

const saveSettings = () => {
  try {

    // remove instructions that are the same as the default
    let settings = JSON.parse(JSON.stringify(store.config))
    for (let instr in settings.instructions) {
      if (settings.instructions[instr] === defaultSettings.instructions[instr]) {
        delete settings.instructions[instr]
      }
    }

    // save
    fs.writeFileSync(settingsFilePath(), JSON.stringify(settings))

  } catch (error) {
    console.log('Error saving settings data', error)
  }
}
