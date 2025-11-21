

import { vi } from 'vitest'
import { store } from '@services/store'
import { Expert } from '@/types'

export const createI18nMock = (callback?: () => Partial<{
  locale: string
}>) => {

  let locale: string|undefined = undefined
  
  return {

    t: (key: string, values?: Record<string, any>) =>
      !values
      ? store.config?.general?.locale
        ? `${key}_${store.config.general.locale}`
        : key
      : `${key}_${store.config?.general?.locale||'default'}_${Object.entries(values)
          .map(([k, v]) => `${k}=${JSON.stringify(v).replace(/^"/g, '').replace(/"$/g, '')}`)
          .join('&')
        }`,

    allLanguages: [
      { locale: 'en-US', label: '🇬🇧 English UK' },
      { locale: 'fr-FR', label: '🇫🇷 Français' },
      { locale: 'es-ES', label: '🇪🇸 Español' },
      { locale: 'de-DE', label: '🇩🇪 Deutsch' },
    ],

    hasLocalization: vi.fn(() => true),
    localeToLangName: (code: string) => code == 'xx-XX' ? '' : code,

    getLlmLocale: vi.fn(() => locale),
    setLlmLocale: vi.fn(l => locale = l),

    expertI18n: vi.fn((expert, attr) => expert?.[attr] ?? `expert_${expert?.id}_${attr}`),
    expertI18nDefault: vi.fn((expert, attr) => `expert_default_${expert?.id}_${attr}`),

    commandI18n: vi.fn((command, attr) => command?.[attr] ?? `command_${command?.id}_${attr}_{input}`),
    commandI18nDefault: vi.fn((command, attr) => `command_default_${command?.id}_${attr}${attr == 'template' ? "-{input}" : ""}`),

    categoryI18n: vi.fn((category, attr) => category?.[attr] ?? `category_${category?.id}_${attr}`),
    categoryI18nDefault: vi.fn((category, attr) => `category_default_${category?.id}_${attr}`),

    fullExpertI18n: function(expert: Expert) {
      return expert ? {
        ...expert,
        name: this.expertI18n(expert, 'name'),
        prompt: this.expertI18n(expert, 'prompt')
      } : undefined
    },

    i18nInstructions: (config: any, key: string) => {

      // init locale
      if (callback) {
        locale = callback().locale
      }

      // init locale
      if (!locale) {
        locale = (() => store.config.llm?.locale || store.config.general.locale || 'default')()
      }

      // get instructions
      const instructions = key.split('.').reduce((obj, token) => obj?.[token], config)
      if (typeof instructions === 'string' && (instructions as string)?.length) {
      return instructions
      }

      // default
      return `${key}_${locale}`

    }
  
  }

}
