
import { reactive } from 'vue'
import { ipcRenderer } from 'electron'
import { loadSettings as _loadSettings } from '../config'
import { saveSettings as _saveSettings } from '../config'
import Chat from '../models/chat'
import path from 'path'
import fs from 'fs'

// a standalone chat window can modify the store and save it
// but it is a separate vuejs application so we will not detecte it
// therefore we need to go back to monitoring the file
const historyMonitorInterval = 1000
let historyLoadedSize = null
let historyMonitor = null

export const store = reactive({
  userDataPath: null,
  commands: [], 
  config: {},
  chats: [],
  pendingAttachment: null
})

store.load = () => {
  store.userDataPath = ipcRenderer.sendSync('get-app-path')
  loadSettings()
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
    historyLoadedSize = fs.statSync(historyFilePath()).size
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

  // start monitoring
  monitorHistory()

}

const saveHistory = () => {

  // avoid infinite loop
  clearInterval(historyMonitor)
  
  try {

    // we need to srip attchment contents
    let chats = store.chats.filter((chat) => chat.messages.length > 1)
    chats = JSON.parse(JSON.stringify(chats))
    for (let chat of chats) {
      for (let message of chat.messages) {
        if (message.attachment) {
          message.attachment.contents = null
        }
      }
    }
    
    // save
    fs.writeFileSync(historyFilePath(), JSON.stringify(chats, null, 2))

  } catch (error) {
    console.log('Error saving history data', error)
  }

  // restart monitoring
  monitorHistory()
}

const monitorHistory = () => {
  clearInterval(historyMonitor)
  historyMonitor = setInterval(() => {
    try {
      const stats = fs.statSync(historyFilePath())
      if (stats.size != historyLoadedSize) {
        const data = fs.readFileSync(historyFilePath(), 'utf-8')
        patchHistory(JSON.parse(data))
        historyLoadedSize = stats.size
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log('Error monitoring history data', error)
      }
    }
  }, historyMonitorInterval)
}

// 
const patchHistory = (jsonChats) => {

  // need to know
  let patched = false

  try {
    for (const jsonChat of jsonChats) {
      let chat = store.chats.find((chat) => chat.uuid === jsonChat.uuid)
      if (chat) {
        patched = patched || chat.patchFromJson(jsonChat)
      } else {
        //console.log('New chat detected')
        let chat = new Chat(jsonChat)
        store.chats.push(chat)
        patched = true
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error patching history data', error)
    }
  }

  // update empty chat ('new chat' is empty)
  if (patched) {
    store.chats.find((chat) => chat.messages.length === 1).lastModified = Date.now()
  }

}

const loadSettings = () => {
  store.config = _loadSettings(settingsFilePath())
}

const saveSettings = () => {
  _saveSettings(settingsFilePath(), store.config)
}
