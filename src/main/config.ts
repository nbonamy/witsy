
import { anyDict } from 'types/index';
import { Configuration } from 'types/config';
import { App } from 'electron'
import defaultSettings from '../../defaults/settings.json'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

let firstLoad = true
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

const mergeConfig = (defaults: anyDict, overrides: anyDict): anyDict => {

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
  if (config.openai || config.ollama) {
    config.engines = {
      openai: config.openai,
      ollama: config.ollama
    }
    delete config.openai
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

  // now build config
  const config = buildConfig(defaultSettings, JSON.parse(data))

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

    // save
    const settingsFile = typeof dest === 'string' ? dest : settingsFilePath(dest)
    fs.writeFileSync(settingsFile, JSON.stringify(config, null, 2))

  } catch (error) {
    console.log('Error saving settings data', error)
  }
}

const nullifyDefaults = (settings: anyDict) => {
  if (settings.engines.openai.baseURL == '' || settings.engines.openai.baseURL === defaultSettings.engines.openai.baseURL) {
    delete settings.engines.openai.baseURL
  }
  if (settings.engines.ollama.baseURL == '' || settings.engines.ollama.baseURL === defaultSettings.engines.ollama.baseURL) {
    delete settings.engines.ollama.baseURL
  }
  if (settings.engines.sdwebui.baseURL == '' || settings.engines.sdwebui.baseURL === defaultSettings.engines.sdwebui.baseURL) {
    delete settings.engines.sdwebui.baseURL
  }
}
