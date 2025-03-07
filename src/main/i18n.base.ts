
import { anyDict } from '../types/index'
import { I18n, createI18n as _createI18n } from 'vue-i18n'

export const createI18n = (messages: anyDict, locale: string, opts?: any): I18n => {

  // now do it
  //console.log('Creating i18n', locale)
  return _createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en-US',
    missingWarn: (typeof(process) === 'undefined') ? true : process.env.TEST ? false : true,
    fallbackWarn: false,
    warnHtmlMessage: false,
    messages,
    ...opts
  })

}

export const hasLocalization = (messages: anyDict, locale: string): boolean => {
  return Object.keys(messages).includes(locale.substring(0, 2))
}
