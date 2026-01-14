
import { store } from '@services/store'

export default function useAppearanceTheme() {
  return {

    get isLight(): boolean {
      return this.getTheme() === 'light'
    },

    get isDark(): boolean {
      return this.getTheme() === 'dark'
    },
    
    getTheme(): string {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    },
    
    getTint(): string {
      if (this.isDark) {
        return store.config.appearance?.darkTint || 'black'
      } else {
        return store.config.appearance?.lightTint || 'white'
      }
    }
  }
}
