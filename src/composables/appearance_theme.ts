
import { store } from '../services/store'

export default function useAppearanceTheme() {
  return {
    getTheme(): string {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    },
    getTint(): string {
      if (this.getTheme() === 'dark') {
        return store.config.appearance.darkTint
      } else {
        return store.config.appearance.lightTint
      }
    }
  }
}
