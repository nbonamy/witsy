
import { anyDict } from '../types/index.d';
import { Configuration } from '../types/config.d';
import defaultSettings from '../../defaults/settings.json'
import { App } from 'electron'
import Monitor from './monitor'
import path from 'path'
import fs from 'fs'

const monitor: Monitor = new Monitor('settings')

const settingsFilePath = (app: App): string => {
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

  // add some methods
  config.getActiveModel = (engine: string) => {
    return config.engines[engine || config.llm.engine].model.chat
  }

  // backwards compatibility
  if (config.openai || config.ollama) {
    config.engines = {
      openai: config.openai,
      ollama: config.ollama
    }
    delete config.openai
    delete config.ollama
  }

  // nullify defaults
  nullifyDefaults(config)

  // done
  return config as Configuration

}

export const loadSettings = (source: App|string): Configuration => {
  let data = '{}'
  try {
    const settingsFile = typeof source === 'string' ? source : settingsFilePath(source)
    monitor.start(settingsFile)
    data = fs.readFileSync(settingsFile, 'utf-8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving settings data', error)
    }
  }
  return buildConfig(defaultSettings, JSON.parse(data))
}

export const saveSettings = (dest: App|string, config: anyDict) => {
  try {

    // nullify defaults
    nullifyDefaults(config)

    // remove instructions that are the same as the default
    const settings = JSON.parse(JSON.stringify(config))
    for (const instr in settings.instructions) {
      if (settings.instructions[instr as keyof typeof settings.instructions] === defaultSettings.instructions[instr as keyof typeof defaultSettings.instructions]) {
        delete settings.instructions[instr]
      }
    }

    // save
    const settingsFile = typeof dest === 'string' ? dest : settingsFilePath(dest)
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2))

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
}
