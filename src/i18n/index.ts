
import { createI18n, I18n } from 'vue-i18n'
import messages from '../../locales/index'

let i18n: I18n|null = null

if (!i18n) {
  const locale = localStorage.getItem('locale') || 'fr'
  console.log('Creating i18n', locale)
  i18n = createI18n({
    legacy: false,
    locale: locale,
    fallbackLocale: 'en',
    messages
  })
}

export default i18n.global
export { i18n }
