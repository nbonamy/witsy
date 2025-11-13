
import { anyDict } from 'types/index'
import { I18n, createI18n as _createI18n } from 'vue-i18n'

export const allLanguages = [
  { locale: 'en-US', label: '🇬🇧 English' },
  { locale: 'fr-FR', label: '🇫🇷 Français' },
  { locale: 'es-ES', label: '🇪🇸 Español' },
  { locale: 'de-DE', label: '🇩🇪 Deutsch' },
  { locale: 'it-IT', label: '🇮🇹 Italiano' },
  { locale: 'pt-PT', label: '🇵🇹 Português' },
  { locale: 'nl-NL', label: '🇳🇱 Nederlands' },
  { locale: 'pl-PL', label: '🇵🇱 Polski' },
  { locale: 'ru-RU', label: '🇷🇺 Русский' },
  { locale: 'ja-JP', label: '🇯🇵 日本語' },
  { locale: 'ko-KR', label: '🇰🇷 한국어' },
  { locale: 'zh-CN', label: '🇨🇳 中文' },
  { locale: 'vi-VN', label: '🇻🇳 Tiếng Việt' },
  { locale: 'th-TH', label: '🇹🇭 ไทย' },
  { locale: 'id-ID', label: '🇮🇩 Bahasa Indonesia' },
  { locale: 'hi-IN', label: '🇮🇳 हिन्दी' },
  { locale: 'ar-SA', label: '🇸🇦 العربية' },
  { locale: 'tr-TR', label: '🇹🇷 Türkçe' },
  { locale: 'ms-MY', label: '🇲🇾 Bahasa Melayu' },
  { locale: 'sw-KE', label: '🇰🇪 Kiswahili' },
]

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
