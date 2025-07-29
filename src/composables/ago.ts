
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import fr from 'javascript-time-ago/locale/fr'
import de from 'javascript-time-ago/locale/de'
import es from 'javascript-time-ago/locale/es'
import it from 'javascript-time-ago/locale/it'
import pt from 'javascript-time-ago/locale/pt'
import ru from 'javascript-time-ago/locale/ru'
import zh from 'javascript-time-ago/locale/zh'
import ja from 'javascript-time-ago/locale/ja'

import { store } from '../services/store'

let initialized = false

export const useTimeAgo = (): TimeAgo => {

  if (!initialized) {
    TimeAgo.addDefaultLocale(en)
    TimeAgo.addLocale(fr)
    TimeAgo.addLocale(de)
    TimeAgo.addLocale(es)
    TimeAgo.addLocale(it)
    TimeAgo.addLocale(pt)
    TimeAgo.addLocale(ru)
    TimeAgo.addLocale(zh)
    TimeAgo.addLocale(ja)
    initialized = true
  }

  return new TimeAgo(store.config.general.locale || 'en')

}
