
import { Configuration } from '../types/config'
import { Folder, History, Store, StoreEvent } from '../types/index'
import { Workspace } from '../types/workspace'
import { reactive } from 'vue'
import { loadCommands } from './commands'
import { loadExperts } from './experts'
import { loadAgents } from './agents'
import features from '../../defaults/features.json'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Chat from '../models/chat'

export const kMediaChatId = '00000000-0000-0000-0000-000000000000'
export const kReferenceParamValue = '<media>'

export const store: Store = reactive({

  config: {} as Configuration,
  workspace: {} as Workspace,
  commands: [], 
  experts: [],
  agents: [],
  history: null,
  listeners: {},
  
  rootFolder: {
    id: 'root',
    name: 'Unsorted',
    chats: null
  } as Folder,

  chatState: {
    filter: null,
  },

  transcribeState: {
    transcription: ''
  },

  isFeatureEnabled(feature: string): boolean {
    const tokens = feature.split('.')
    let current = (features as Record<string, any>)[tokens[0]]
    for (let i=1; i<tokens.length; i++) {
      current = current?.[tokens[i]]
    }
    return current !== false
  },

  addListener: (event: StoreEvent, listener: CallableFunction): void => {
    if (!store.listeners[event]) {
      store.listeners[event] = []
    }
    store.listeners[event].push(listener)
  },

  removeListener: (event: StoreEvent, listener: CallableFunction): void => {
    if (!store.listeners[event]) return
    store.listeners[event] = store.listeners[event].filter(l => l !== listener)
  },

  activateWorkspace: (workspaceId: string): void => {

    // update settings
    store.config.workspaceId = workspaceId
    store.saveSettings()
    
    // reload data for the new workspace
    store.loadWorkspace()
    store.loadHistory()
    store.loadExperts()
    store.loadAgents()

    // notify listeners
    for (const listener of store.listeners['workspaceSwitched'] || []) {
      listener()
    }
  },

  loadWorkspace: (): void => {
    loadWorkspace()
  },

  loadSettings: (): void => {
    
    // load settings
    loadSettings()
    loadWorkspace()

    // we need to check the model list versions
    const llmManager = LlmFactory.manager(store.config)
    llmManager.checkModelListsVersion()

    // subscribe to file changes
    window.api.on('file-modified', (file) => {
      if (file === 'settings') {
        loadSettings()
      } else if (file === 'commands') {
        loadCommands()
      } else if (file === 'experts') {
        loadExperts()
      } else if (file === 'agents') {
        loadAgents()
      }
    })

  },

  loadHistory: (): void => {

    // load history
    loadHistory()

    // subscribe to file changes
    window.api.on('file-modified', (file) => {
      if (file === 'history') {
        mergeHistory(window.api.history.load(store.config.workspaceId))
      }
    })

  },

  loadCommands: (): void => {
    loadCommands()
  },

  loadExperts: (): void => {
    loadExperts()
  },

  loadAgents: (): void => {
    loadAgents()
  },

  load: async (): Promise<void> => {

    //perf
    //const start = Date.now()

    // load data
    store.loadSettings()
    store.loadWorkspace()
    store.loadCommands()
    store.loadHistory()
    store.loadExperts()
    store.loadAgents()

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
      chat.tools = defaults.tools !== undefined ? defaults.tools : (defaults.disableTools ? [] : null)
      chat.locale = defaults.locale
      chat.instructions = defaults.instructions
      chat.modelOpts = {
        contextWindowSize: defaults.contextWindowSize,
        maxTokens: defaults.maxTokens,
        temperature: defaults.temperature,
        top_k: defaults.top_k,
        top_p: defaults.top_p,
        reasoning: defaults.reasoning,
        reasoningBudget: defaults.reasoningBudget,
        reasoningEffort: defaults.reasoningEffort,
        verbosity: defaults.verbosity,
        thinkingBudget: defaults.thinkingBudget,
      }
      if (defaults.customOpts) {
        chat.modelOpts.customOpts = defaults.customOpts
      }
    } else {
      chat.disableStreaming = false
      chat.tools = store.config.engines[chat.engine]?.disableTools ? [] : null
      chat.locale = null
      chat.instructions = null
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
        quickPrompts: JSON.parse(JSON.stringify(store.history.quickPrompts || [])),
        //padPrompts: JSON.parse(JSON.stringify(store.history.padPrompts || [])),
      }
      for (const chat of history.chats) {
        for (const message of chat.messages) {
          for (const attachment of message.attachments) {
            attachment.content = null
          }
        }
      }
      
      // save
      window.api.history.save(store.config.workspaceId, history)
  
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

const loadWorkspace = (): void => {
  store.workspace = window.api.workspace.load(store.config.workspaceId)
}

const loadHistory = (): void => {

  try {
    store.history = { folders: [], chats: [], quickPrompts: [], /*padPrompts: []*/ }
    const history = window.api.history.load(store.config.workspaceId)
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
