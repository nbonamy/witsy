
import { vi, beforeAll, expect, test } from 'vitest'
import { app } from 'electron'
import { store } from '../../src/services/store'
import { createI18n } from 'vue-i18n'
import { useWindowMock } from '../mocks/window'
import { getLocaleUi, getLocaleLlm, useI18n } from '../../src/main/i18n'
import { i18nInstructions, localeToLangName } from '../../src/services/i18n'

vi.mock('electron', async() => {
  return {
    app: {
      getLocale: vi.fn(() => 'en-US'),
      getPath: vi.fn(() => '')
    },
  }
})

vi.mock('vue-i18n', async() => {
  return {
    createI18n: vi.fn(() => ({ global: { t: vi.fn() } }))
  }
})

vi.mock('../../src/main/config', async() => {
  return {
    loadSettings: vi.fn(() => store.config)
  }
})

beforeAll(() => {
  useWindowMock()
  store.config = {
    general: {
      locale: ''
    },
    llm: {
      locale: ''
    }
  }
})

test('Get UI Locale', async () => {
  
  // default to system language
  expect(getLocaleUi(app)).toBe('en-US')
  expect(getLocaleLlm(app)).toBe('en-US')

  // override llm locale
  store.config.llm.locale = 'fr-FR'
  expect(getLocaleUi(app)).toBe('en-US')
  expect(getLocaleLlm(app)).toBe('fr-FR')

  // override both
  store.config.general.locale = 'es-ES'
  expect(getLocaleUi(app)).toBe('es-ES')
  expect(getLocaleLlm(app)).toBe('fr-FR')

  // override only one
  store.config.llm.locale = ''
  expect(getLocaleUi(app)).toBe('es-ES')
  expect(getLocaleLlm(app)).toBe('es-ES')

})

test('Init i18n', async () => {

  store.config.general.locale = 'de-DE'
  useI18n(app)
  expect(createI18n).toHaveBeenCalledWith({
    legacy: false,
    locale: 'de-DE',
    fallbackLocale: 'en',
    messages: expect.any(Object)
  })

})

test('Localized instructions', async () => {

  expect(i18nInstructions({ instructions: {} }, 'instructions.default')).not.toBe('instructions.default')

  expect(i18nInstructions({ instructions: { titling: 'hello'} }, 'instructions.default')).not.toBe('instructions.default')

  expect(i18nInstructions({
    instructions: { default: 'Hello' }
   }, 'instructions.default')).toBe('Hello')

   expect(i18nInstructions({
    instructions: { scratchpad: { default: 'Hello' } }
   }, 'instructions.scratchpad.default')).toBe('Hello')

})

test('Country code to Name', async () => {
  expect(localeToLangName('en-US')).toBe('English')
  expect(localeToLangName('es-ES')).toBe('Español')
  expect(localeToLangName('fr-FR')).toBe('Français')
  expect(localeToLangName('de-DE')).toBe('Deutsch')
  expect(localeToLangName('it-IT')).toBe('Italiano')
  expect(localeToLangName('pt-PT')).toBe('Português')
  expect(localeToLangName('nl-NL')).toBe('Nederlands')
  expect(localeToLangName('pl-PL')).toBe('Polski')
  expect(localeToLangName('ru-RU')).toBe('Русский')
  expect(localeToLangName('ja-JP')).toBe('日本語')
  expect(localeToLangName('ko-KR')).toBe('한국어')
  expect(localeToLangName('zh-CN')).toBe('中文')
  expect(localeToLangName('vi-VN')).toBe('Tiếng Việt')
  expect(localeToLangName('th-TH')).toBe('ไทย')
  expect(localeToLangName('id-ID')).toBe('Bahasa Indonesia')
  expect(localeToLangName('hi-IN')).toBe('हिन्दी')
  expect(localeToLangName('ar-SA')).toBe('العربية')
  expect(localeToLangName('tr-TR')).toBe('Türkçe')
  expect(localeToLangName('ms-MY')).toBe('Bahasa Melayu')
  expect(localeToLangName('sw-KE')).toBe('Kiswahili')
  expect(localeToLangName('xx-XX')).toBe('')
})
