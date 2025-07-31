

import { vi } from 'vitest'
import { store } from '../../src/services/store'

export const onEventMock = vi.fn()
export const emitEventMock = vi.fn()

export const createEventBusMock = (emitMock?: (event: string, ...args: any[]) => void) => {
  if (emitMock) {
    emitEventMock.mockImplementation(emitMock)
  }
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
} 

export const createDialogMock = (callback?: (args) => Partial<{
  isConfirmed: boolean
  isDenied: boolean
  isDismissed: boolean
  value?: any
}>) => {

  const defaultResponse = {
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
  }

  return {
    default: {
      alert: vi.fn((args) => Promise.resolve({
        ...defaultResponse,
        ...callback?.(args)
      })),
      show: vi.fn((args) => Promise.resolve({
      ...defaultResponse,
      ...callback?.(args)
    })),
    }
  }

}

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
      : `${key}_${store.config.general.locale||'default'}_${Object.entries(values)
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

    expertI18n: vi.fn((expert, attr) => `expert_${expert?.id}_${attr}`),
    expertI18nDefault: vi.fn((expert, attr) => `expert_default_${expert?.id}_${attr}`),

    commandI18n: vi.fn((command, attr) => `command_${command?.id}_${attr}_{input}`),
    commandI18nDefault: vi.fn((command, attr) => `command_default_${command?.id}_${attr}${attr == 'template' ? "-{input}" : ""}`),

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

export const createAutomatorMock = (callback?: () => Partial<{
  selectedText: string|null
}>) => {

  const selectedText = 'Grabbed text'

  const Automator = vi.fn()
  Automator.prototype.getForemostApp = vi.fn(() => ({ id: 'appId', name: 'appName', path: 'appPath', window: 'title' }))
  Automator.prototype.moveCaretBelow = vi.fn()
  Automator.prototype.getSelectedText = vi.fn((): string|null => { return callback ? callback().selectedText ?? null : selectedText })
  Automator.prototype.pasteText = vi.fn()
  return { default: Automator }

}
