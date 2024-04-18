
import { anyDict } from '../types/index.d';
import { Configuration } from '../types/config.d';
import { App } from 'electron'
import defaultSettings from '../../defaults/settings.json'
import path from 'path'
import fs from 'fs'

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

  // add some methods
  config.getActiveModel = () => {
    return config.engines[config.llm.engine].model.chat
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

  // done
  return config as Configuration

}

export const loadSettings = (filepath: string): Configuration => {
  let data = '{}'
  try {
    data = fs.readFileSync(filepath, 'utf-8')
    console.log('Settings data loaded from', filepath, data)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving settings data', error)
    }
  }
  return buildConfig(defaultSettings, JSON.parse(data))
}

export const saveSettings = (filepath: string, config: anyDict) => {
  try {

    // remove instructions that are the same as the default
    const settings = JSON.parse(JSON.stringify(config))
    for (const instr in settings.instructions) {
      if (settings.instructions[instr as keyof typeof settings.instructions] === defaultSettings.instructions[instr as keyof typeof defaultSettings.instructions]) {
        delete settings.instructions[instr]
      }
    }

    // save
    fs.writeFileSync(filepath, JSON.stringify(settings, null, 2))

  } catch (error) {
    console.log('Error saving settings data', error)
  }
}