import { createApp } from 'vue'
import { vTooltip } from './renderer/directives/tooltip'
import i18n from './renderer/services/i18n'
import App from './renderer/App.vue'

try {
  const app = createApp(App)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.mount('#app')
} catch (e) {
  alert(e)
}
