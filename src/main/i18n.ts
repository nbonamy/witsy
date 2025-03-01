
import { App } from 'electron'
import { createI18n } from 'vue-i18n'
import { loadSettings } from './config'
import messages from '../../locales/index'

export const getLocale = (app: App): string => {

  // load settings
  const config = loadSettings(app)
  if (config.general.locale?.length) {
    return config.general.locale
  }

  // get system language
  const locale = app.getLocale()
  const lang = locale.substring(0, 2)

  // vue-i18n will fallback if invalid
  return lang

}

export const useI18n = (app: App): CallableFunction => {

  // load settings
  const locale = getLocale(app)

  // now do it
  console.log('Creating i18n', locale)
  return createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  }).global.t as CallableFunction

}
