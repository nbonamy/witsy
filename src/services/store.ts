
import { Store, StoreListener } from 'types/index.d'
import { reactive } from 'vue'
import { loadCommands } from './commands'
import { loadExperts } from './experts'
import { isEngineReady, initModels, availableEngines } from '../llms/llm'
import Chat from '../models/chat'

export const store: Store = reactive({

  config: null,
  commands: [], 
  experts: [],
  chats: [],
  chatFilter: null,
  pendingAttachment: null,
  pendingDocRepo: null,
  listeners: [],

  addListener: (listener: StoreListener) : void => {
    store.listeners.push(listener)
  },

  notifyListeners: (domain: string) : void => {
    store.listeners.forEach((listener) => {
      listener.onStoreUpdated(domain)
    })
  },

  loadSettings: async () => {
    loadSettings()
  },

  loadHistory: async () => {
    loadHistory()
  },

  loadCommands: async () => {
    loadCommands()
  },

  loadExperts: async () => {
    loadExperts()
  },

  load: async () => {

    // load data
    store.loadSettings()
    store.loadCommands()
    loadHistory()
    loadExperts()

    // subscribe to file changes
    window.api.on('file-modified', (signal) => {
      if (signal === 'settings') {
        loadSettings()
      } else if (signal === 'history') {
        mergeHistory(window.api.history.load())
      }
    })

    // load models and select valid engine
    initModels()
    if (!isEngineReady(store.config.llm.engine)) {
      for (const engine of availableEngines) {
        if (isEngineReady(engine)) {
          console.log(`Default engine ready, selecting ${engine} as default`)
          store.config.llm.engine = engine
          break
        }
      }
    }

  },

  saveSettings: () => {
    window.api.config.save(JSON.parse(JSON.stringify(store.config)))
  },
  
  saveHistory: () => {

    try {
  
      // we need to srip attachment contents
      const chats = JSON.parse(JSON.stringify(store.chats.filter((chat) => chat.messages.length > 1)))
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
  
  },
  
  dump: () => {
    console.dir(JSON.parse(JSON.stringify(store.config)))
  },

})

const loadSettings = () => {
  store.config = window.api.config.load()
  store.notifyListeners('config')
}

const loadHistory = () => {

  try {
    store.chats = []
    const history = window.api.history.load()
    for (const jsonChat of history) {
      const chat = new Chat(jsonChat)
      store.chats.push(chat)
    }
    store.notifyListeners('history')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }

}

// 
const mergeHistory = (jsonChats: any[]) => {

  // need to know
  let patched = false

  // get the current ids and new ids
  const currentIds = store.chats.map((chat) => chat.uuid)
  const newIds = jsonChats.map((chat) => chat.uuid)

  // remove deleted chats
  const deletedIds = currentIds.filter((id) => !newIds.includes(id))
  //console.log(`Deleting ${deletedIds.length} chats`)
  if (deletedIds.length > 0) {
    store.chats = store.chats.filter((chat) => !deletedIds.includes(chat.uuid))
    patched = true
  }

  // add the new chats
  const addedIds = newIds.filter((id) => !currentIds.includes(id))
  //console.log(`Adding ${addedIds.length} chats`)
  for (const addedId of addedIds) {
    const chat = new Chat(jsonChats.find((chat) => chat.uuid === addedId))
    store.chats.push(chat)
    patched = true
  }

  // patch the existing chats
  for (const chat of store.chats) {
    const jsonChat = jsonChats.find((c) => c.uuid === chat.uuid)
    if (jsonChat) {
      //console.log(`Patching chat ${chat.uuid}`)
      patched = chat.patchFromJson(jsonChat) || patched 
    }
  }

  // save
  if (patched) {
    store.saveHistory()
  }

}
