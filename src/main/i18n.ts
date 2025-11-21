
import { anyDict } from 'types/index'
import { App } from 'electron'
import { createI18n } from './i18n.base'
import { loadSettings } from './config'

import en from '@root/locales/en.json'
import fr from '@root/locales/fr.json'
import es from '@root/locales/es.json'
import de from '@root/locales/de.json'
import it from '@root/locales/it.json'
import pl from '@root/locales/pl.json'
import pt from '@root/locales/pt.json'
import zh from '@root/locales/zh.json'
import ja from '@root/locales/ja.json'

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

export const getLocaleMessages = (app: App): Record<string, any> => {

  // already calculated?
  if (Object.keys(messages).length) {
    return messages
  }
  
  // standard messages
  messages = {
    en, fr, es, de, it, pl, pt, zh, ja
  }

  const userDataPath = app.getPath('userData')
  const localesPath = path.join(userDataPath, 'locales')

  // scan folder for all json files and load them
  if (fs.existsSync(localesPath)) {
    const files = fs.readdirSync(localesPath)
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const locale = file.replace('.json', '')
          const data = fs.readFileSync(path.join(localesPath, file), 'utf8')
          messages[locale] = JSON.parse(data)
        } catch (err: any) {
          console.error(`Failed to load locale file "${file}":`, err.message)
        }
      }
    }
  }

  // done
  return messages

}