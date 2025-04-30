
import { Configuration } from 'types/config'
import { Folder, History, Store } from 'types/index'
import { reactive } from 'vue'
import { loadCommands } from './commands'
import { loadExperts } from './experts'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Chat from '../models/chat'

export const kMediaChatId = '00000000-0000-0000-0000-000000000000'
export const kReferenceParamValue = '<media>'

export const store: Store = reactive({

  config: {} as Configuration,
  commands: [], 
  experts: [],
  history: null,
  chatFilter: null,

  rootFolder: {
    id: 'root',
    name: 'Unsorted',
    chats: null
  } as Folder,

  loadSettings: (): void => {
    loadSettings()
  },

  loadHistory: (): void => {
    loadHistory()
  },

  loadCommands: (): void => {
    loadCommands()
  },

  loadExperts: (): void => {
    loadExperts()
  },

  load: async (): Promise<void> => {

    //perf
    //const start = Date.now()

    // load data
    store.loadSettings()
    store.loadCommands()
    store.loadHistory()
    store.loadExperts()

    // subscribe to file changes
    window.api.on('file-modified', (file) => {
      if (file === 'settings') {
        loadSettings()
      } else if (file === 'history') {
        mergeHistory(window.api.history.load())
      }
    })

    // load models and select valid engine
    const llmManager: ILlmManager = LlmFactory.manager(store.config)
    await llmManager.initModels()
    if (!llmManager.isEngineReady(store.config.llm.engine)) {
      for (const engine of llmManager.getChatEngines({ favorites: false })) {
        if (llmManager.isEngineReady(engine)) {
          console.log(`Selected engine not ready, selecting ${engine} as default`)
          store.config.llm.engine = engine
          break
        }
      }
    }

    // perf
    //console.log(`Store loaded in ${Date.now() - start}ms`)


  },

  saveSettings: (): void => {
    window.api.config.save(JSON.parse(JSON.stringify(store.config)))
  },

  initChatWithDefaults(chat: Chat): void {

    const defaults = store.config.llm.defaults.find(d => d.engine === chat.engine && d.model === chat.model)
    if (defaults) {
      chat.disableStreaming = defaults.disableStreaming
      chat.disableTools = defaults.disableTools
      chat.locale = defaults.locale
      chat.prompt = defaults.prompt
      chat.modelOpts = {
        contextWindowSize: defaults.contextWindowSize,
        maxTokens: defaults.maxTokens,
        temperature: defaults.temperature,
        top_k: defaults.top_k,
        top_p: defaults.top_p,
        reasoning: defaults.reasoning,
        reasoningEffort: defaults.reasoningEffort,
      }
      if (defaults.customOpts) {
        chat.modelOpts.customOpts = defaults.customOpts
      }
    } else {
      chat.disableStreaming = false
      chat.disableTools = store.config.engines[chat.engine]?.disableTools || false
      chat.locale = null
      chat.prompt = null
      chat.modelOpts = undefined
    }
  },

  addChat: (chat: Chat, folderId?: string): void => {

    // add to folder
    if (folderId) {
      const folder = store.history.folders.find((f) => f.id === folderId)
      if (folder) {
        folder.chats.push(chat.uuid)
      }
    }

    // add to history
    store.history.chats.push(chat)
    store.saveHistory()

  },

  removeChat: (chat: Chat): void => {

    // remove from folders
    for (const folder of store.history.folders) {
      folder.chats = folder.chats.filter((id) => id !== chat.uuid)
    }

    // remove from history
    store.history.chats = store.history.chats.filter((c) => c.uuid !== chat.uuid)
    store.saveHistory()

  },

  addQuickPrompt: (prompt: string): void => {
    if (prompt.trim().length === 0) return
    store.history.quickPrompts = store.history.quickPrompts.filter((p) => p !== prompt)
    store.history.quickPrompts.push(prompt)
    store.history.quickPrompts = store.history.quickPrompts.slice(-100)
    store.saveHistory()
  },

  // addPadPrompt: (prompt: string): void => {
  //   store.history.padPrompts = store.history.padPrompts.filter((p) => p !== prompt)
  //   store.history.padPrompts.push(prompt)
  //   store.history.padPrompts = store.history.padPrompts.slice(-100)
  //   store.saveHistory()
  // },

  saveHistory: (): void => {

    try {

      // we need to srip attachment contents
      const history = {
        folders: JSON.parse(JSON.stringify(store.history.folders)),
        chats: JSON.parse(JSON.stringify(store.history.chats)).filter((chat: Chat) => {
          return chat.messages.length > 1 || store.history.folders.find((folder) => folder.chats.includes(chat.uuid))
        }),
        quickPrompts: JSON.parse(JSON.stringify(store.history.quickPrompts)),
        //padPrompts: JSON.parse(JSON.stringify(store.history.padPrompts)),
      }
      for (const chat of history.chats) {
        for (const message of chat.messages) {
          if (message.attachment) {
            message.attachment.content = null
          }
        }
      }
      
      // save
      window.api.history.save(history)
  
    } catch (error) {
      console.log('Error saving history data', error)
    }
  
  },
  
  dump: (): void => {
    console.dir(JSON.parse(JSON.stringify(store.config)))
  },

})

const loadSettings = (): void => {
  // we don't want to reassign store.config
  // as others are referencing it directly
  // so we update locally instead
  // in store.test.ts: expect(store.config).toBe(backup)
  // checks exactly for that
  const updated = window.api.config.load()
  const newKeys = Object.keys(updated)
  const obsoleteKeys = Object.keys(store.config).filter((key) => !newKeys.includes(key))
  for (const key of obsoleteKeys) {
    // @ts-expect-error direct key access
    delete store.config[key]
  }
  for (const key of Object.keys(updated)) {
    // @ts-expect-error direct key access
    store.config[key] = updated[key]
  }
}

const loadHistory = (): void => {

  try {
    store.history = { folders: [], chats: [], quickPrompts: [], /*padPrompts: []*/ }
    const history = window.api.history.load()
    store.history.folders = history.folders || []
    store.history.quickPrompts = history.quickPrompts || []
    //store.history.padPrompts = history.padPrompts || []
    for (const jsonChat of history.chats) {
      const chat = Chat.fromJson(jsonChat)
      store.history.chats.push(chat)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving history data', error)
    }
  }

}

// 
const mergeHistory = (jsonHistory: History): void => {

  // only if loaded
  if (!store.history) {
    return
  }

  // overwrite folders and prompts
  store.history.folders = jsonHistory.folders || []
  store.history.quickPrompts = jsonHistory.quickPrompts || []
  //store.history.padPrompts = jsonHistory.padPrompts || []
  
  // get the current ids and new ids
  const currentIds = store.history.chats.map((chat) => chat.uuid)
  const newIds = jsonHistory.chats.map((chat) => chat.uuid)

  // remove deleted chats
  const deletedIds = currentIds.filter((id) => !newIds.includes(id))
  //console.log(`Deleting ${deletedIds.length} chats`)
  if (deletedIds.length > 0) {
    store.history.chats = store.history.chats.filter((chat) => !deletedIds.includes(chat.uuid))
  }

  // add the new chats
  const addedIds = newIds.filter((id) => !currentIds.includes(id))
  //console.log(`Adding ${addedIds.length} chats`)
  for (const addedId of addedIds) {
    const chat = Chat.fromJson(jsonHistory.chats.find((chat) => chat.uuid === addedId))
    store.history.chats.push(chat)
  }

  // patch the existing chats
  for (const chat of store.history.chats) {
    const jsonChat = jsonHistory.chats.find((c) => c.uuid === chat.uuid)
    if (jsonChat) {
      //console.log(`Patching chat ${chat.uuid}`)
      chat.patchFromJson(jsonChat)
    }
  }

}
