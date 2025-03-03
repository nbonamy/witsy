
import { I18n, createI18n as _createI18n } from 'vue-i18n'
import messages from '../../locales/index'

export const createI18n = (locale: string, opts?: any): I18n => {

  // now do it
  //console.log('Creating i18n', locale)
  return _createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en-US',
    // missingWarn: false, 
    fallbackWarn: false,
    warnHtmlMessage: false,
    messages,
    ...opts
  })

}

export const hasLocalization = (locale: string): boolean => {
  return Object.keys(messages).includes(locale.substring(0, 2))
}
