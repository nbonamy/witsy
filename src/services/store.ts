
import { Store } from '../types/index.d'
import { reactive } from 'vue'
//import { loadSettings as _loadSettings , saveSettings as _saveSettings } from '../main/config'
import { isEngineReady, loadAllModels, availableEngines } from './llm'
import Chat from '../models/chat'

// a standalone chat window can modify the store and save it
// but it is a separate vuejs application so we will not detecte it
// therefore we need to go back to monitoring the file
const historyMonitorInterval = 1000
let historyLoadedSize: number = null
let historyMonitor: NodeJS.Timeout = null

export const store: Store = reactive({
  userDataPath: null,
  commands: [], 
  config: null,
  chats: [],
  pendingAttachment: null,
})

store.load = async () => {

  // load data
  store.userDataPath = window.api.userDataPath
  loadSettings()
  loadHistory()

  // load models
  // and select valid engine
  await loadAllModels()
  if (!isEngineReady(store.config.llm.engine)) {
    for (const engine of availableEngines) {
      if (isEngineReady(engine)) {
        console.log(`Default engine ready, selecting ${engine} as default`)
        store.config.llm.engine = engine
        break
      }
    }
  }
}

store.dump = () => {
  console.dir(JSON.parse(JSON.stringify(store.config)))
}

const loadHistory = () => {

  try {
    store.chats = []
    const history = window.api.history.load()
    historyLoadedSize = window.api.history.size()
    for (const jsonChat of history) {
      const chat = new Chat(jsonChat)
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

store.saveHistory = () => {

  // avoid infinite loop
  clearInterval(historyMonitor)
  
  try {

    // we need to srip attchment contents
    const chats = JSON.parse(JSON.stringify(store.chats))
    for (const chat of chats) {
      for (const message of chat.messages) {
        if (message.attachment) {
          message.attachment.contents = null
        }
      }
    }
    
    // save
    window.api.history.save(chats)

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
      const size = window.api.history.size()
      if (size != historyLoadedSize) {
        const history = window.api.history.load()
        patchHistory(history)
        historyLoadedSize = size
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log('Error monitoring history data', error)
      }
    }
  }, historyMonitorInterval)
}

// 
const patchHistory = (jsonChats: any[]) => {

  // need to know
  let patched = false

  try {
    for (const jsonChat of jsonChats) {
      const chat: any = store.chats.find((chat) => chat.uuid === jsonChat.uuid)
      if (chat) {
        if (jsonChat.deleted) {
          store.chats = store.chats.filter((chat) => chat.uuid !== jsonChat.uuid)
          patched = true
        } else {
          patched = patched || chat.patchFromJson(jsonChat)
        }
      } else {
        const chat = new Chat(jsonChat)
        store.chats.push(chat)
        patched = true
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error patching history data', error)
    }
  }

  // save
  if (patched) {
    store.saveHistory()
  }

}

const loadSettings = () => {
  store.config = window.api.config.load()
  store.config.getActiveModel = () => {
    return store.config.engines[store.config.llm.engine].model.chat
  }
}

store.saveSettings = () => {
  window.api.config.save(JSON.parse(JSON.stringify(store.config)))
}
