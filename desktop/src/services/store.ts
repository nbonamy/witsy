
import { Store } from '../types/index.d'
import { reactive } from 'vue'
import { loadCommands } from './commands'
import { loadPrompts } from './prompts'
import { isEngineReady, loadAllModels, availableEngines } from './llm'
import Chat from '../models/chat'

export const store: Store = reactive({
  config: null,
  commands: [], 
  prompts: [],
  chats: [],
  chatFilter: null,
  pendingAttachment: null,
})

store.load = async () => {

  // load data
  loadSettings()
  loadHistory()
  loadCommands()
  loadPrompts()

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

  // subscribe to file changes
  window.api.on('file-modified', (signal) => {
    if (signal === 'settings') {
      loadSettings()
    } else if (signal === 'history') {
      mergeHistory(window.api.history.load())
    }
  })

}

store.dump = () => {
  console.dir(JSON.parse(JSON.stringify(store.config)))
}

const loadSettings = () => {
  store.config = window.api.config.load()
  store.config.getActiveModel = (engine: string) => {
    return store.config.engines[engine || store.config.llm.engine].model.chat
  }
}

store.saveSettings = () => {
  window.api.config.save(JSON.parse(JSON.stringify(store.config)))
}

const loadHistory = () => {

  try {
    store.chats = []
    const history = window.api.history.load()
    for (const jsonChat of history) {
      const chat = new Chat(jsonChat)
      store.chats.push(chat)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }

}

store.saveHistory = () => {

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

}

// 
const mergeHistory = (jsonChats: any[]) => {

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
