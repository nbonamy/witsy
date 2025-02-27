
import { createI18n } from 'vue-i18n'
import messages from '../../locales/index'

let i18n = null

if (!i18n) {
  console.log('Creating i18n')
  i18n = createI18n({
    locale: localStorage.getItem('locale') || 'en',
    fallbackLocale: 'en',
    messages
  })
}

export default i18n.global