import { createApp } from 'vue'
import { BootstrapIconsPlugin } from 'bootstrap-icons-vue'
import { vTooltip } from './directives/tooltip'
import i18n from './services/i18n'
import App from './App.vue'

try {
  const app = createApp(App)
  app.use(i18n)
  app.use(BootstrapIconsPlugin)
  app.directive('tooltip', vTooltip)
  app.mount('#app')
} catch (e) {
  alert(e)
}
