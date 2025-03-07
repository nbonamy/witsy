import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  allowComposition: true
})
i18n.global.t = key => key
config.global.plugins = [i18n]
