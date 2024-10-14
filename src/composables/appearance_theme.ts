
export default function useAppearanceTheme() {
  return {
    getTheme(): string {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    },
  }
}
