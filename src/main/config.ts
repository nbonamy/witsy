
import { anyDict } from '../types/index'
import { Configuration } from '../types/config'
import { App } from 'electron'
import { favoriteMockEngine } from '../llms/llm'
import defaultSettings from '../../defaults/settings.json'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

let firstLoad = true
let errorLoadingConfig = false
let onSettingsChange: CallableFunction = () => {}

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
    saveSettings(settingsFile, config)
  }

  // start monitoring
  monitor.start(settingsFile)

  // done
  firstLoad = false
  return config
}

export const saveSettings = (dest: App|string, config: Configuration) => {
  try {

    // nullify defaults
    nullifyDefaults(config)

    // make a copy
    const clone: Configuration = JSON.parse(JSON.stringify(config))
    if (typeof dest !== 'string') {

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
