
import defaultSettings from '../defaults/settings.json'
import path from 'path'
import fs from 'fs'

export const settingsFilePath = (app) => {
  const userDataPath = app.getPath('userData')
  const settingsFilePath = path.join(userDataPath, 'settings.json')
  return settingsFilePath
}

const mergeConfig = (defaults, overrides) => {

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

const buildConfig = (defaults, overrides) => {

  // 1st merge
  let config = mergeConfig(defaults, overrides)

  // add some methods
  config.getActiveModel = () => {
    return config[config.llm.engine].models.chat
  }

  // done
  return config

}

export const loadSettings = (filepath) => {
  let data = '{}'
  try {
    data = fs.readFileSync(filepath, 'utf-8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving settings data', error)
    }
  }
  return buildConfig(defaultSettings, JSON.parse(data))
}

export const saveSettings = (filepath, config) => {
  try {

    // remove instructions that are the same as the default
    let settings = JSON.parse(JSON.stringify(config))
    for (let instr in settings.instructions) {
      if (settings.instructions[instr] === defaultSettings.instructions[instr]) {
        delete settings.instructions[instr]
      }
    }

    // save
    fs.writeFileSync(filepath, JSON.stringify(settings, null, 2))

  } catch (error) {
    console.log('Error saving settings data', error)
  }
}