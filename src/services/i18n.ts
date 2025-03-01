
import { anyDict } from '../types/index'
import { createI18n, I18n } from 'vue-i18n'
import messages from '../../locales/index'

let i18n: I18n|null = null
let i18nLlm: I18n|null = null

if (!i18n) {

  // load locale
  const locale = window.api?.config?.localeUI() || 'en-US'
  //console.log('Creating i18n', locale)

  // now do it
  i18n = createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  })
}

if (!i18nLlm) {

  // load locale
  const locale = window.api?.config?.localeLLM() || 'en-US'
  //console.log('Creating i18n for Llm', locale)

  // now do it
  i18nLlm = createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  })
}

const localeToLangName = (locale: string): string => {
  const t = i18nLlm.global.t as CallableFunction
  const language = t(`common.language.${locale}`)
  return language.startsWith('common.language.') ? locale : language
}

const t: CallableFunction = i18n?.global?.t

const i18nInstructions = (config: anyDict, key: string, params?: any): string => {

  // get instructions
  const instructions = key.split('.').reduce((obj, token) => obj?.[token], config)
  if (typeof instructions === 'string' && (instructions as string)?.length) {
    return instructions
  }

  // default
  // @ts-expect-error not sure why
  return i18nLlm.global.t(key, params)

}

const hasLocalization = (locale: string): boolean => {
  return Object.keys(messages).includes(locale.substring(0, 2))
}

export {
  i18n as default,
  i18nLlm,
  t,
  i18nInstructions,
  localeToLangName,
  hasLocalization
}
