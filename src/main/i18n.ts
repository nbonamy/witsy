
import { App } from 'electron'
import { createI18n } from './i18n.base'
import { loadSettings } from './config'

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
  return createI18n(locale).global.t as CallableFunction
}

export const useI18nLlm = (app: App): CallableFunction => {
  const locale = getLocaleLLM(app)
  return createI18n(locale).global.t as CallableFunction
}
