import { createApp } from 'vue'
import { BootstrapIconsPlugin } from 'bootstrap-icons-vue'
import { i18n } from './i18n'
import App from './App.vue'

try {
  const app = createApp(App)
  app.use(i18n)
  app.use(BootstrapIconsPlugin)
  app.mount('#app')
} catch (e) {
  alert(e)
}
