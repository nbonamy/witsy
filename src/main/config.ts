
import { anyDict } from '../types/index'
import { Configuration } from '../types/config'
import { App, safeStorage } from 'electron'
import { favoriteMockEngine } from '../llms/llm'
import Store from 'electron-store'
import defaultSettings from '../../defaults/settings.json'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

type ApiKeyEntry = {
  name: string
  apiKey: string
}

let firstLoad = true
let errorLoadingConfig = false
let onSettingsChange: CallableFunction = () => {}

const safeStore = new Store<Record<string, string>>({
  name: 'apiKeys',
  accessPropertiesByDotNotation: false,
  watch: false,
  encryptionKey: 'witsy',
});

const monitor: Monitor = new Monitor(() => {
  onSettingsChange()
})

export const setOnSettingsChange = (callback: CallableFunction) => {
  onSettingsChange = callback
}

export const settingsFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const settingsFilePath = path.join(userDataPath, 'settings.json')
  return settingsFilePath
}

export const apiKeysFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const apiKeysFilePath = path.join(userDataPath, 'apiKeys.json')
  return apiKeysFilePath
}

const engineConfigFilePath = (app: App, engine: string): string => {
  const userDataPath = app.getPath('userData')
  const engineModelsFilePath = path.join(userDataPath, 'engines')
  fs.mkdirSync(engineModelsFilePath, { recursive: true })
  return path.join(engineModelsFilePath, `${engine}.json`)
}

export const settingsFileHadError = (): boolean => errorLoadingConfig

const mergeConfig = (defaults: anyDict, overrides: anyDict): Configuration => {

  const result = JSON.parse(JSON.stringify(defaults))
  
  Object.keys(overrides).forEach(key => {

    if (typeof defaults[key] === 'object' && typeof overrides[key] === 'object'
      && !Array.isArray(overrides[key]) && overrides[key] !== null
      && !Array.isArray(defaults[key]) && defaults[key] !== null) {
      result[key] = mergeConfig(defaults[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  })

  return result
}

const buildConfig = (defaults: anyDict, overrides: anyDict): Configuration => {

  // 1st merge
  const config = mergeConfig(defaults, overrides)

  // backwards compatibility
  if ('bypassProxy' in config.general) {
    if (config.general.bypassProxy) {
      config.general.proxyMode = 'bypass'
    }
    delete config.general.bypassProxy
  }

  // backwards compatibility
  if ('tint' in config.appearance) {
    // @ts-expect-error backwards compatibility
    config.appearance.darkTint = config.appearance.tint
    delete config.appearance.tint
  }

  // backwards compatibility
  if ('servers' in config.plugins.mcp) {
    config.mcp.servers = config.plugins.mcp.servers
    config.mcp.smitheryApiKey = config.plugins.mcp.smitheryApiKey
    delete config.plugins.mcp
  }

  // backwards compatibility
  // @ts-expect-error backwards compatibility
  if (config.openai || config.ollama) {
    config.engines = {
      // @ts-expect-error backwards compatibility
      openai: config.openai,
      // @ts-expect-error backwards compatibility
      ollama: config.ollama
    }
    // @ts-expect-error backwards compatibility
    delete config.openai
    // @ts-expect-error backwards compatibility
    delete config.ollama
  }

  // backwards compatibility
  if (config.plugins.tavily) {
    config.plugins.search = {
      enabled: config.plugins.tavily.enabled,
      engine: config.plugins.tavily.enabled ? 'tavily' : 'local',
      tavilyApiKey: config.plugins.tavily.apiKey
    }
    delete config.plugins.tavily
  }

  // backwards compatibility
  for (const modelDefaults of config.llm.defaults) {
    // @ts-expect-error backwards compatibility
    if (modelDefaults.prompt) {
    // @ts-expect-error backwards compatibility
      modelDefaults.instructions = modelDefaults.prompt
    // @ts-expect-error backwards compatibility
      delete modelDefaults.prompt
    }
  }

  // backwards compatibility
  // @ts-expect-error backwards compatibility
  if (config.shortcuts.chat) {
    // @ts-expect-error backwards compatibility
    config.shortcuts.main = config.shortcuts.chat
    // @ts-expect-error backwards compatibility
    delete config.shortcuts.chat
  }

  // nullify defaults
  nullifyDefaults(config)

  // done
  return config as Configuration

}

export const loadSettings = (source: App|string): Configuration => {

  let data = '{}'
  const settingsFile = typeof source === 'string' ? source : settingsFilePath(source)
  if (firstLoad) {
    console.log('Loading settings from', settingsFile)
  }

  let save = true
  try {
    data = fs.readFileSync(settingsFile, 'utf-8')
    save = false
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving settings data', error)
    }
  }

  // now try to parse
  let jsonConfig = null 
  try {
    jsonConfig = JSON.parse(data)
  } catch (error) {

    // log
    console.log('Error parsing settings data', error)

    // save a backup before starting from scratch
    if (typeof source !== 'string' && firstLoad) {
      const now = new Date()
      const timestamp = now.getFullYear() + 
               ('0' + (now.getMonth() + 1)).slice(-2) + 
               ('0' + now.getDate()).slice(-2) + 
               ('0' + now.getHours()).slice(-2) + 
               ('0' + now.getMinutes()).slice(-2) + 
               ('0' + now.getSeconds()).slice(-2)
      const backupFile = settingsFilePath(source).replace('.json', `.${timestamp}.json`)
      console.log('Saving backup of settings to', backupFile)
      fs.writeFileSync(backupFile, data)
    }

    // start with defaults
    errorLoadingConfig = true
    jsonConfig = {}

  }

  // backwards compatibility
  let apiKeys = extractApiKeys(jsonConfig)
  if (apiKeys.length > 0) {
    saveApiKeys(apiKeys)
    save = true
  } else {
    apiKeys = loadApiKeys()
    injectApiKeys(jsonConfig, apiKeys)
  }

  // now load engine models
  if (typeof source !== 'string' && jsonConfig.engines) {
    
    for (const engine of Object.keys(jsonConfig.engines)) {

      // initialize models
      if (!jsonConfig.engines[engine].models) {
        jsonConfig.engines[engine].models = { chat: [] } 
      }

      // now load the models file
      const engineConfigFile = engineConfigFilePath(source, engine)
      if (fs.existsSync(engineConfigFile)) {
        try {
          const engineConfig = fs.readFileSync(engineConfigFile, 'utf-8')
          jsonConfig.engines[engine] = {
            ...jsonConfig.engines[engine],
            ...JSON.parse(engineConfig)
          }
        } catch (error) {
          console.log('Error loading engine models for', engine, error)
        }
      }

    }
  }

  // now build config
  const config = buildConfig(defaultSettings, jsonConfig)

  // save if needed
  if (save && !process.env.TEST) {
    saveSettings(source, config)
  }

  // start monitoring
  monitor.start(settingsFile)

  // done
  firstLoad = false
  return config
}

let lastSaved: string

export const saveSettings = (dest: App|string, config: Configuration): void => {
  try {

    // nullify defaults
    nullifyDefaults(config)

    // save only if modified
    if (lastSaved && lastSaved === JSON.stringify(config)) {
      return
    }

    // update
    lastSaved = JSON.stringify(config)

    // make a copy
    const clone: Configuration = JSON.parse(JSON.stringify(config))
    if (typeof dest !== 'string') {

      // save api keys separately
      const apiKeys = extractApiKeys(clone)
      if (apiKeys.length > 0) {
        if (saveApiKeys(apiKeys)) {
          nullifyApiKeys(clone, apiKeys)
        }
      }

      // save engines configuration separately
      for (const engine of Object.keys(clone.engines)) {

        // skip the favorite mock engine
        if (engine === favoriteMockEngine) {
          continue
        }

        // clone user data
        const engineConfig = {
          models: clone.engines[engine].models,
          voices: clone.engines[engine].voices,
        }

        // now save it
        const engineConfigFile = engineConfigFilePath(dest, engine)
        fs.writeFileSync(engineConfigFile, JSON.stringify(engineConfig, null, 2))

        // clear clone
        delete clone.engines[engine].models
        delete clone.engines[engine].voices

      }

    }

    // save
    const settingsFile = typeof dest === 'string' ? dest : settingsFilePath(dest)
    fs.writeFileSync(settingsFile, JSON.stringify(clone, null, 2))

  } catch (error) {
    console.log('Error saving settings data', error)
  }
}

const nullifyDefaults = (settings: anyDict) => {
  if (settings.engines.openai && (settings.engines.openai.baseURL == '' || settings.engines.openai.baseURL === defaultSettings.engines.openai.baseURL)) {
    delete settings.engines.openai.baseURL
  }
  if (settings.engines.ollama && (settings.engines.ollama.baseURL == '' || settings.engines.ollama.baseURL === defaultSettings.engines.ollama.baseURL)) {
    delete settings.engines.ollama.baseURL
  }
  if (settings.engines.lmstudio && (settings.engines.lmstudio.baseURL == '' || settings.engines.lmstudio.baseURL === defaultSettings.engines.lmstudio.baseURL)) {
    delete settings.engines.lmstudio.baseURL
  }
  if (settings.engines.sdwebui && (settings.engines.sdwebui.baseURL == '' || settings.engines.sdwebui.baseURL === defaultSettings.engines.sdwebui.baseURL)) {
    delete settings.engines.sdwebui.baseURL
  }
}

export const loadApiKeys = (): ApiKeyEntry[] => {

  // check
  if (!safeStorage.isEncryptionAvailable()) {
    return []
  }

  try {
    const credentials = Object.entries(safeStore.store)
    return credentials.reduce((apiKeys, [name, buffer]) => {
      try {
        const apiKey = safeStorage.decryptString(Buffer.from(buffer, 'latin1'))
        return [...apiKeys, { name, apiKey }]
      } catch (error) {
        console.log(`Error decrypting API key for ${name}:`, error)
        safeStore.delete(name)
        return apiKeys
      }
    }, [] as ApiKeyEntry[]);
  } catch (error) {
    console.log('Error loading API keys:', error)
    return []
  }
}

export const saveApiKeys = (apiKeys: ApiKeyEntry[]): boolean => {

  try {

    // check
    if (!safeStorage.isEncryptionAvailable()) {
      return false
    }

    // First, delete all existing apiKey entries
    try {
      const credentials = loadApiKeys()
      for (const credential of credentials) {
        safeStore.delete(credential.name)
      }
    } catch (error) {
      console.log('Error clearing existing API keys:', error)
      return false
    }
    
    // Save new entries
    for (const entry of apiKeys) {
      if (entry.apiKey.length > 0) {
        try {
          const buffer = safeStorage.encryptString(entry.apiKey);
          safeStore.set(entry.name, buffer.toString('latin1'));
        } catch (error) {
          console.log(`Error saving API key for ${entry.name}:`, error)
        }
      }
    }

    // done
    return true

  } catch (error) {
    console.log('Error saving API keys:', error)
    return false
  }

}

export const extractApiKeys = (config: anyDict, path: string = ''): ApiKeyEntry[] => {

  const apiKeys: ApiKeyEntry[] = []
  
  try {
    
    const traverse = (obj: anyDict, currentPath: string) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key]
          const fullPath = currentPath ? `${currentPath}.${key}` : key
          
          if (key.toLowerCase().includes('apikey') && typeof value === 'string') {
            apiKeys.push({ name: fullPath, apiKey: value })
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            traverse(value, fullPath)
          }
        }
      }
    }
    
    traverse(config, path)

  } catch (error) {
    console.log('Error extracting API keys:', error)
  }

  // done
  return apiKeys
}


export const injectApiKeys = (config: Configuration, apiKeys: ApiKeyEntry[]): void => {
  
  try {

    for (const entry of apiKeys) {
      const pathParts = entry.name.split('.')
      let current = config as anyDict
      
      // Navigate to the parent object
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {}
        }
        current = current[pathParts[i]]
      }
      
      // Set the API key
      const lastKey = pathParts[pathParts.length - 1]
      current[lastKey] = entry.apiKey
    }

  } catch (error) {
    console.log('Error injecting API keys:', error)
  }

}

export const nullifyApiKeys = (config: anyDict, apiKeys: ApiKeyEntry[]): void => {

  try {

    for (const entry of apiKeys) {
      const pathParts = entry.name.split('.')
      let current = config

      for (let i = 0; i < pathParts.length - 1; i++) {
        if (current[pathParts[i]] && typeof current[pathParts[i]] === 'object') {
          current = current[pathParts[i]]
        } else {
          break
        }
      }
      
      const lastKey = pathParts[pathParts.length - 1]
      if (current && Object.prototype.hasOwnProperty.call(current, lastKey)) {
        delete current[lastKey]
      }
    }

  } catch (error) {
    console.log('Error nullifying API keys:', error)
  }
  
}
