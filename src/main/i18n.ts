
import { anyDict } from '../types/index'
import { App } from 'electron'
import { createI18n } from './i18n.base'
import { loadSettings } from './config'

import en from '../../locales/en.json'
import fr from '../../locales/fr.json'
import es from '../../locales/es.json'
import de from '../../locales/de.json'
import it from '../../locales/it.json'
import pt from '../../locales/pt.json'

import path from 'path'
import fs from 'fs'

let messages: anyDict = {}

export const getLocaleUI = (app: App): string => {

  // load settings
  const config = loadSettings(app)
  if (config.general.locale?.length) {
    return config.general.locale
  }

  // get system locale
  const locale = app.getLocale()
  return locale

}

export const getLocaleLLM = (app: App): string => {

  // load settings
  const config = loadSettings(app)
  if (config.llm.locale?.length) {
    return config.llm.locale
  }

  // default to UI locale
  return getLocaleUI(app)

}

export const useI18n = (app: App): CallableFunction => {
  const locale = getLocaleUI(app)
  const i18n = createI18n(getLocaleMessages(app), locale)
  return i18n.global.t as CallableFunction
}

export const useI18nLlm = (app: App): CallableFunction => {
  const locale = getLocaleLLM(app)
  const i18n = createI18n(getLocaleMessages(app), locale)
  return i18n.global.t as CallableFunction
}

export const getLocaleMessages = (app: App): anyDict => {

  // already calculated?
  if (Object.keys(messages).length) {
    return messages
  }
  
  // standard messages
  messages = {
    en, fr, es, de, it, pt
  }

  const userDataPath = app.getPath('userData')
  const localesPath = path.join(userDataPath, 'locales')

  // scan folder for all json files and load them
  if (fs.existsSync(localesPath)) {
    const files = fs.readdirSync(localesPath)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const locale = file.replace('.json', '')
        const data = fs.readFileSync(path.join(localesPath, file), 'utf8')
        messages[locale] = JSON.parse(data)
      }
    }
  }

  // done
  return messages

}