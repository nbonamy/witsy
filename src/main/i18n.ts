
import { App } from 'electron'
import { createI18n } from 'vue-i18n'
import { loadSettings } from './config'
import messages from '../../locales/index'

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

  // load settings
  const locale = getLocaleUI(app)

  // now do it
  console.log('Creating i18n', locale)
  return createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  }).global.t as CallableFunction

}
