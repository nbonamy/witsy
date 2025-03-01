
import { createI18n, I18n } from 'vue-i18n'
import messages from '../../locales/index'

let i18n: I18n|null = null

if (!i18n) {

  // load locale
  const locale = window.api?.config?.locale() || 'en'
  console.log('Creating i18n', locale)

  // now do it
  i18n = createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  })
}

export default i18n
export const t = i18n.global.t as CallableFunction

export const countryCodeToName = (code: string): string => {
  if (code == 'en') return 'English'
  if (code == 'es') return 'Spanish'
  if (code == 'fr') return 'French'
  if (code == 'de') return 'German'
  if (code == 'it') return 'Italian'
  if (code == 'pt') return 'Portuguese'
  if (code == 'nl') return 'Dutch'
  if (code == 'pl') return 'Polish'
  if (code == 'ru') return 'Russian'
  if (code == 'ja') return 'Japanese'
  if (code == 'ko') return 'Korean'
  if (code == 'zh') return 'Chinese'
  if (code == 'vi') return 'Vietnamese'
  if (code == 'th') return 'Thai'
  if (code == 'id') return 'Indonesian'
  if (code == 'hi') return 'Hindi'
  if (code == 'ar') return 'Arabic'
  if (code == 'tr') return 'Turkish'
  if (code == 'ms') return 'Malay'
  if (code == 'fi') return ' Filipino'
  if (code == 'sw') return 'Swahili'
  console.error(`Unknown language code: ${code}`)
  return 'English' 
}