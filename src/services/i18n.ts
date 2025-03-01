
import { anyDict } from '../types/index'
import { createI18n, I18n } from 'vue-i18n'
import messages from '../../locales/index'

let i18n: I18n|null = null
let i18nLlm: I18n|null = null

if (!i18n) {

  // load locale
  const locale = window.api?.config?.localeUi() || 'en'
  console.log('Creating i18n', locale)

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
  const locale = window.api?.config?.localeLlm() || 'en'
  console.log('Creating i18n for Llm', locale)

  // now do it
  i18nLlm = createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  })
}

const countryCodeToLangName = (code: string): string => {
  if (code == 'en') return 'English'
  if (code == 'es') return 'Español'
  if (code == 'fr') return 'Français'
  if (code == 'de') return 'Deutsch'
  if (code == 'it') return 'Italiano'
  if (code == 'pt') return 'Português'
  if (code == 'nl') return 'Nederlands'
  if (code == 'pl') return 'Polski'
  if (code == 'ru') return 'Русский'
  if (code == 'ja') return '日本語'
  if (code == 'ko') return '한국어'
  if (code == 'zh') return '中文'
  if (code == 'vi') return 'Tiếng Việt'
  if (code == 'th') return 'ไทย'
  if (code == 'id') return 'Bahasa Indonesia'
  if (code == 'hi') return 'हिन्दी'
  if (code == 'ar') return 'العربية'
  if (code == 'tr') return 'Türkçe'
  if (code == 'ms') return 'Bahasa Melayu'
  if (code == 'fi') return 'Filipino'
  if (code == 'sw') return 'Kiswahili'
  console.error(`Unknown language code: ${code}`)
  return 'English' 
}

const t: CallableFunction = i18n?.global?.t

const i18nInstructions = (config: anyDict, key: string, params?: any): string => {

  //
  const tokens = key.split('.')
  let instructions = config
  if (instructions) {
    for (const token of tokens) {
      instructions = instructions[token]
      if (!instructions) {
        break
      }
    }
  }

  // valid
  if (typeof instructions === 'string' && (instructions as string)?.length) {
    return instructions
  }

  // default
  // @ts-expect-error not sure why
  return i18nLlm.global.t(key, params)

}

export {
  i18n as default,
  i18nLlm,
  t,
  i18nInstructions,
  countryCodeToLangName
}
