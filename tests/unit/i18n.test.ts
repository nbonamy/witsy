
import { vi, beforeAll, expect, test } from 'vitest'
import { app } from 'electron'
import { store } from '../../src/services/store'
import { createI18n } from 'vue-i18n'
import { useWindowMock } from '../mocks/window'
import { getLocaleUi, getLocaleLlm, useI18n } from '../../src/main/i18n'
import { i18nInstructions, countryCodeToLangName } from '../../src/services/i18n'

vi.mock('electron', async() => {
  return {
    app: {
      getLocale: vi.fn(() => 'en'),
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
  expect(getLocaleUi(app)).toBe('en')
  expect(getLocaleLlm(app)).toBe('en')

  // override llm locale
  store.config.llm.locale = 'fr'
  expect(getLocaleUi(app)).toBe('en')
  expect(getLocaleLlm(app)).toBe('fr')

  // override both
  store.config.general.locale = 'es'
  expect(getLocaleUi(app)).toBe('es')
  expect(getLocaleLlm(app)).toBe('fr')

  // override only one
  store.config.llm.locale = ''
  expect(getLocaleUi(app)).toBe('es')
  expect(getLocaleLlm(app)).toBe('es')

})

test('Init i18n', async () => {

  store.config.general.locale = 'de'
  useI18n(app)
  expect(createI18n).toHaveBeenCalledWith({
    legacy: false,
    locale: 'de',
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
  expect(countryCodeToLangName('en')).toBe('English')
  expect(countryCodeToLangName('es')).toBe('Español')
  expect(countryCodeToLangName('fr')).toBe('Français')
  expect(countryCodeToLangName('de')).toBe('Deutsch')
  expect(countryCodeToLangName('it')).toBe('Italiano')
  expect(countryCodeToLangName('pt')).toBe('Português')
  expect(countryCodeToLangName('nl')).toBe('Nederlands')
  expect(countryCodeToLangName('pl')).toBe('Polski')
  expect(countryCodeToLangName('ru')).toBe('Русский')
  expect(countryCodeToLangName('ja')).toBe('日本語')
  expect(countryCodeToLangName('ko')).toBe('한국어')
  expect(countryCodeToLangName('zh')).toBe('中文')
  expect(countryCodeToLangName('vi')).toBe('Tiếng Việt')
  expect(countryCodeToLangName('th')).toBe('ไทย')
  expect(countryCodeToLangName('id')).toBe('Bahasa Indonesia')
  expect(countryCodeToLangName('hi')).toBe('हिन्दी')
  expect(countryCodeToLangName('ar')).toBe('العربية')
  expect(countryCodeToLangName('tr')).toBe('Türkçe')
  expect(countryCodeToLangName('ms')).toBe('Bahasa Melayu')
  expect(countryCodeToLangName('fi')).toBe('Filipino')
  expect(countryCodeToLangName('sw')).toBe('Kiswahili')
  expect(countryCodeToLangName('xx')).toBe('')
})
