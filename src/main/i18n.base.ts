
import { I18n, createI18n as _createI18n } from 'vue-i18n'
import messages from '../../locales/index'

export const createI18n = (locale: string): I18n => {

  // now do it
  //console.log('Creating i18n', locale)
  return _createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    missingWarn: false, 
    fallbackWarn: false,
    silentTranslationWarn: true,
    messages
  })

}

export const hasLocalization = (locale: string): boolean => {
  return Object.keys(messages).includes(locale.substring(0, 2))
}
