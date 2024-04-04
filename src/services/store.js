
import { reactive } from 'vue'
import { ipcRenderer } from 'electron'
import Chat from '../models/chat'
import path from 'path'
import fs from 'fs'

let userDataPath = null

export const store = reactive({
  config: {},
  chats: [],
})

store.load = (defaults = {}) => {
  userDataPath = ipcRenderer.sendSync('get-app-path')
  loadSettings(defaults)
  loadHistory()
}

store.save = () => {
  fs.writeFileSync(historyFilePath(), JSON.stringify(store.chats.filter((chat) => chat.messages.length > 1)))
  fs.writeFileSync(settingsFilePath(), JSON.stringify(store.config))
}

function historyFilePath() {
  return path.join(userDataPath, 'history.json')
}

function settingsFilePath() {
  return path.join(userDataPath, 'settings.json')
}

function loadHistory() {
  try {
    store.chats = []
    const data = fs.readFileSync(historyFilePath(), 'utf-8')
    const jsonChats = JSON.parse(data)
    for (let jsonChat of jsonChats) {
      let chat = new Chat(jsonChat)
      store.chats.push(chat)
    }
  } catch (error) {
    console.log('Error retrieving user data', error)
  }
}

function loadSettings(defaults) {
  try {
    const data = fs.readFileSync(settingsFilePath(), 'utf-8')
    store.config = {...defaults, ...JSON.parse(data)}
  } catch (error) {
    console.log('Error retrieving user data', error)
  }
}
