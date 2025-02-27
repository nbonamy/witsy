import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { BootstrapIconsPlugin } from 'bootstrap-icons-vue'
import App from './App.vue'

import messages from '../locales/index'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'en',
  fallbackLocale: 'en',
  messages
})

try {
  const app = createApp(App)
  app.use(i18n)
  app.use(BootstrapIconsPlugin)
  app.mount('#app')
} catch (e) {
  alert(e)
}
